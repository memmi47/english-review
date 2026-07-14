// drills.ts — 정제된 문제은행(드릴) 모듈 (신규 보조 모듈)
//
// schema.ts/srs.ts 등 "검증된 규격" 7개 파일은 건드리지 않고, study.ts처럼
// 별도의 Dexie DB에 문제은행을 저장한다. srs.ts의 schedule()만 읽기 전용으로 사용.
//
// 문제은행은 Claude 정제 세션에서 만들어진다:
//   원본 피드백(교정/리라이트) → 중복 병합·STT 오염 복원·고유명사 일반화 →
//   3가지 유형의 문제(choice/pattern/produce)로 변환된 JSON 파일.
// 앱은 이 파일을 가져와(upsert) 렌더링·채점·SRS 스케줄만 담당한다.

import Dexie, { type Table } from 'dexie';
import { today } from './schema';
import { schedule, type Grade } from './srs';

// ── 타입 ──────────────────────────────────────────────

// choice  : 3지선다 빈칸 — 문장의 핵심 스팬만 빈칸, 보기 중 하나를 탭
// pattern : 패턴 전이 드릴 — 같은 문법 패턴을 새로운 맥락 문장에 직접 타이핑
// produce : 한→영 표현하기 — 한국어 의도를 보고 영어로 직접 표현 (복수 정답 인정)
export type DrillType = 'choice' | 'pattern' | 'produce';

export interface DrillRow {
  id: string;
  type: DrillType;
  tag: string;               // 오류 태그 (verbal-noun, articles, ...)
  severity: string | null;   // 화석화 | 반복 | 일회성 | null
  group_id: string | null;   // 패턴 드릴 세트 묶음 (같은 세트는 연속 출제)
  question: string;          // choice/pattern: '_____' 포함 문장, produce: 한국어 의도
  hint: string;              // 힌트 (한국어 설명, 없으면 '')
  choices: string[];         // choice: 보기 3개, 그 외: []
  answer: string;            // 정답 (빈칸 채움말 또는 모범 문장)
  accept: string[];          // 추가 인정 답안 (produce/pattern)
  explain: string;           // 채점 후 보여줄 한국어 해설
  // SRS 상태 (가져오기 시 초기화, 재가져오기 시 보존)
  srs_box: number;
  due_date: string;
  reps: number;
  lapses: number;
  created_at: string;
}

class DrillsDB extends Dexie {
  drills!: Table<DrillRow, string>;
  constructor() {
    super('EnglishReviewDrillsDB');
    this.version(1).stores({
      drills: 'id, type, tag, due_date, group_id',
    });
  }
}

export const drillsDB = new DrillsDB();

// ── 문제은행 파일 가져오기 ─────────────────────────────

export interface DrillBankFile {
  drill_bank_version: number;
  exported_at?: string;
  drills: Array<Pick<DrillRow,
    'id' | 'type' | 'tag' | 'severity' | 'group_id' |
    'question' | 'hint' | 'choices' | 'answer' | 'accept' | 'explain'
  >>;
}

const DRILL_TYPES: DrillType[] = ['choice', 'pattern', 'produce'];

function validateDrill(d: unknown, i: number): string | null {
  if (typeof d !== 'object' || d === null) return `${i + 1}번 항목이 객체가 아닙니다.`;
  const r = d as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id) return `${i + 1}번 항목에 id가 없습니다.`;
  if (!DRILL_TYPES.includes(r.type as DrillType)) return `${i + 1}번 항목의 type이 올바르지 않습니다: ${String(r.type)}`;
  if (typeof r.question !== 'string' || !r.question) return `${i + 1}번 항목에 question이 없습니다.`;
  if (typeof r.answer !== 'string' || !r.answer) return `${i + 1}번 항목에 answer가 없습니다.`;
  if (r.type === 'choice') {
    if (!Array.isArray(r.choices) || r.choices.length < 2) return `${i + 1}번 choice 항목에 보기가 2개 미만입니다.`;
    if (!(r.choices as string[]).includes(r.answer as string)) return `${i + 1}번 choice 항목의 정답이 보기에 없습니다.`;
  }
  if ((r.type === 'choice' || r.type === 'pattern') && !(r.question as string).includes('_____')) {
    return `${i + 1}번 ${String(r.type)} 항목의 question에 빈칸(_____)이 없습니다.`;
  }
  return null;
}

// 문제은행 JSON을 가져온다. 같은 id가 이미 있으면 문제 내용만 갱신하고
// SRS 진행 상태(box/날짜/횟수)는 보존한다.
export async function importDrillBank(jsonText: string): Promise<{ added: number; updated: number }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText.trim());
  } catch {
    throw new Error('JSON 형식이 아닙니다. 문제은행 파일(.json)을 선택했는지 확인해주세요.');
  }
  const bank = parsed as Partial<DrillBankFile>;
  if (typeof bank.drill_bank_version !== 'number' || !Array.isArray(bank.drills)) {
    throw new Error('문제은행 파일이 아닙니다 (drill_bank_version / drills 누락). 백업 파일과 혼동하지 않았는지 확인해주세요.');
  }
  for (let i = 0; i < bank.drills.length; i++) {
    const err = validateDrill(bank.drills[i], i);
    if (err) throw new Error(err);
  }

  const t = today();
  const now = new Date().toISOString();
  let added = 0, updated = 0;

  await drillsDB.transaction('rw', drillsDB.drills, async () => {
    for (const d of bank.drills!) {
      const existing = await drillsDB.drills.get(d.id);
      if (existing) {
        await drillsDB.drills.update(d.id, {
          type: d.type, tag: d.tag ?? '', severity: d.severity ?? null,
          group_id: d.group_id ?? null, question: d.question, hint: d.hint ?? '',
          choices: d.choices ?? [], answer: d.answer, accept: d.accept ?? [],
          explain: d.explain ?? '',
        });
        updated++;
      } else {
        await drillsDB.drills.add({
          id: d.id, type: d.type, tag: d.tag ?? '', severity: d.severity ?? null,
          group_id: d.group_id ?? null, question: d.question, hint: d.hint ?? '',
          choices: d.choices ?? [], answer: d.answer, accept: d.accept ?? [],
          explain: d.explain ?? '',
          srs_box: 1, due_date: t, reps: 0, lapses: 0, created_at: now,
        });
        added++;
      }
    }
  });
  return { added, updated };
}

// ── 출제 ──────────────────────────────────────────────

const SEVERITY_WEIGHT: Record<string, number> = { '화석화': 0, '반복': 1, '일회성': 2 };

// 오늘 풀 문제 목록: 심각도(화석화 우선) → 예정일 순.
// 같은 group_id(패턴 세트)는 연속으로 묶어서 출제한다.
export async function dueDrills(limit = 20): Promise<DrillRow[]> {
  const t = today();
  const due = await drillsDB.drills.where('due_date').belowOrEqual(t).toArray();

  due.sort((a, b) => {
    const wa = SEVERITY_WEIGHT[a.severity ?? ''] ?? 3;
    const wb = SEVERITY_WEIGHT[b.severity ?? ''] ?? 3;
    if (wa !== wb) return wa - wb;
    if (a.due_date !== b.due_date) return a.due_date.localeCompare(b.due_date);
    return a.id.localeCompare(b.id);
  });

  // group_id 단위로 묶기: 먼저 등장한 그룹 순서를 유지하며 멤버를 이어붙인다.
  const seen = new Set<string>();
  const grouped: DrillRow[] = [];
  for (const d of due) {
    if (seen.has(d.id)) continue;
    if (d.group_id) {
      for (const member of due.filter(x => x.group_id === d.group_id)) {
        if (!seen.has(member.id)) { grouped.push(member); seen.add(member.id); }
      }
    } else {
      grouped.push(d); seen.add(d.id);
    }
  }
  return grouped.slice(0, limit);
}

export async function dueDrillCount(): Promise<number> {
  const t = today();
  return drillsDB.drills.where('due_date').belowOrEqual(t).count();
}

export async function totalDrillCount(): Promise<number> {
  return drillsDB.drills.count();
}

export async function reviewDrill(id: string, grade: Grade): Promise<void> {
  const d = await drillsDB.drills.get(id);
  if (!d) return;
  const { srs_box, due_date } = schedule(d.srs_box, grade);
  await drillsDB.drills.update(id, {
    srs_box, due_date,
    reps: d.reps + 1,
    lapses: d.lapses + (grade === 'again' ? 1 : 0),
  });
}

// ── 채점 헬퍼 ─────────────────────────────────────────

// 대소문자/문장부호/공백 차이를 무시하고 비교
export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[.,!?;:"()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function answerMatches(userInput: string, drill: DrillRow): boolean {
  const n = normalizeAnswer(userInput);
  if (!n) return false;
  if (n === normalizeAnswer(drill.answer)) return true;
  return drill.accept.some(a => normalizeAnswer(a) === n);
}
