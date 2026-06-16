// parser.ts — 리포트 파서 (규격서 4절 파싱 계약 구현)
// 입력: 붙여넣은 리포트 markdown 전문 → 출력: 구조화된 ParsedReport

import { CANONICAL_TAGS, SEVERITIES, type CanonicalTag, type TagValue, type Severity } from './schema';

// --- Parsed shapes (ingest가 id·session_id를 부여) ---
export interface ParsedCorrection { original: string; corrected: string; rule: string; error_tag: TagValue; severity: Severity | null; }
export interface ParsedSuspect { heard: string; intended: string; }
export interface ParsedRewrite { user_expr: string; native_version: string; nuance: string; tag: TagValue; }
export interface ParsedPattern { type: 'strength' | 'weakness'; description: string; canonical_tag: TagValue; severity: Severity | null; }
export interface ParsedPhrase { phrase: string; meaning: string; note: string; example: string; tags: (CanonicalTag | 'unmapped')[]; }
export interface ParsedVocab { word: string; meaning: string; note: string; tags: (CanonicalTag | 'unmapped')[]; }
export interface ParsedAction { suggestion: string; target_tag: TagValue; }
export interface ParsedMission { mission: string; status: string; }

export interface ParsedReport {
  raw: string;
  meta: { date: string | null; topic: string | null; duration_min: number | null };
  missions: ParsedMission[];
  corrections: ParsedCorrection[];
  transcription_suspects: ParsedSuspect[];
  rewrites: ParsedRewrite[];
  patterns: ParsedPattern[];
  phrases: ParsedPhrase[];
  vocab: ParsedVocab[];
  actions: ParsedAction[];
}

export interface ParseResult { ok: boolean; errors: string[]; warnings: string[]; data?: ParsedReport; }

// --- Helpers ---

// 규칙 2: 섹션 헤더 '## N. ...' / '## 2b. ...' 로 본문 분할
function splitSections(raw: string): Record<string, string> {
  const re = /^##\s+(\d+b?)\.\s+.*$/gm;
  const out: Record<string, string> = {};
  const matches = [...raw.matchAll(re)];
  for (let i = 0; i < matches.length; i++) {
    const key = matches[i][1];
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : raw.length;
    out[key] = raw.slice(start, end).trim();
  }
  return out;
}

// 규칙 3: 마크다운 파이프 표 → 데이터 행(헤더·구분선 제외)
function parseTable(body: string): string[][] {
  const lines = body.split('\n').map(l => l.trim()).filter(l => l.startsWith('|'));
  const rows: string[][] = [];
  for (const line of lines) {
    const inner = line.replace(/^\|/, '').replace(/\|$/, '');
    const cells = inner.split('|').map(c => c.trim());
    if (cells.every(c => c === '' || /^:?-{2,}:?$/.test(c))) continue; // 구분선 스킵
    rows.push(cells);
  }
  if (rows.length) rows.shift(); // 헤더 행 제거
  return rows;
}

// 규칙 4: [tag] 추출 + 사전 미등재 시 'unmapped' 격리
function extractTag(cell: string): { tag: TagValue; warn?: string } {
  const m = cell.match(/\[([a-z0-9-]+)\]/);
  if (!m) return { tag: null };
  const t = m[1];
  if ((CANONICAL_TAGS as readonly string[]).includes(t)) return { tag: t as CanonicalTag };
  return { tag: 'unmapped', warn: `미등재 태그 [${t}] — 검수 필요` };
}

function extractTags(cell: string): { tags: (CanonicalTag | 'unmapped')[]; warns: string[] } {
  const ms = [...cell.matchAll(/\[([a-z0-9-]+)\]/g)];
  const tags: (CanonicalTag | 'unmapped')[] = [];
  const warns: string[] = [];
  for (const m of ms) {
    const t = m[1];
    if ((CANONICAL_TAGS as readonly string[]).includes(t)) tags.push(t as CanonicalTag);
    else { tags.push('unmapped'); warns.push(`미등재 태그 [${t}] — 검수 필요`); }
  }
  return { tags, warns };
}

// 규칙 5: severity enum 검증, 외 값은 null
function validSeverity(cell: string): Severity | null {
  return (SEVERITIES as readonly string[]).find(s => cell.includes(s)) as Severity | undefined ?? null;
}

// 규칙 1: 메타데이터(주석 우선, 라인 폴백)
function parseMeta(raw: string) {
  const c = raw.match(/<!--\s*meta:\s*date=([^|]+?)\s*\|\s*topic=([^|]+?)\s*\|\s*duration_min=([^>]+?)\s*-->/);
  if (c) return { date: norm(c[1]), topic: norm(c[2]), duration_min: toNum(c[3]) };
  const l = raw.match(/날짜:\s*([^|]+?)\s*\|\s*주제:\s*([^|]+?)\s*\|\s*소요시간:\s*([0-9]+)\s*분/);
  if (l) return { date: norm(l[1]), topic: norm(l[2]), duration_min: parseInt(l[3], 10) };
  return { date: null as string | null, topic: null as string | null, duration_min: null as number | null };
}
const norm = (s: string) => s.trim();
const toNum = (s: string) => { const n = parseInt(s.replace(/\D/g, ''), 10); return Number.isNaN(n) ? null : n; };

// 규칙 6: 빈 섹션 sentinel
const SENTINELS = [
  '오늘은 문법·어휘 오류가 발견되지 않았습니다.',
  '없음',
  '이전 미션 정보 없음',
];
function isEmptySection(body: string, rows: string[][]): boolean {
  if (rows.length > 0) return false;
  return SENTINELS.some(s => body.includes(s)) || body.trim() === '';
}

// --- Main ---
export function parseReport(raw: string): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const sections = splitSections(raw);
  if (Object.keys(sections).length === 0) {
    return { ok: false, errors: ['인식 가능한 섹션 헤더가 없습니다. 템플릿 양식을 확인하세요.'], warnings };
  }

  const meta = parseMeta(raw);
  if (!meta.date) warnings.push('메타 날짜를 찾지 못했습니다 — 적재 시 오늘 날짜로 대체됩니다.');
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) warnings.push(`날짜 형식 비정상: "${meta.date}"`);

  // 0. 지난 미션 점검
  const missions: ParsedMission[] = [];
  if (sections['0']) {
    const rows = parseTable(sections['0']);
    if (!isEmptySection(sections['0'], rows)) {
      rows.forEach(r => missions.push({ mission: r[0] ?? '', status: r[1] ?? '' }));
    }
  }

  // 2. 정확성 교정
  const corrections: ParsedCorrection[] = [];
  if (sections['2']) {
    const rows = parseTable(sections['2']);
    if (!isEmptySection(sections['2'], rows)) {
      for (const r of rows) {
        const { tag, warn } = extractTag(r[3] ?? '');
        if (warn) warnings.push(`[2.교정] ${warn}`);
        corrections.push({
          original: r[0] ?? '', corrected: r[1] ?? '', rule: r[2] ?? '',
          error_tag: tag, severity: validSeverity(r[4] ?? ''),
        });
      }
    }
  }

  // 2b. 전사 의심 (통계 제외)
  const transcription_suspects: ParsedSuspect[] = [];
  if (sections['2b']) {
    const rows = parseTable(sections['2b']);
    if (!isEmptySection(sections['2b'], rows)) {
      rows.forEach(r => transcription_suspects.push({ heard: r[0] ?? '', intended: r[1] ?? '' }));
    }
  }

  // 3. Native-like Rewrites
  const rewrites: ParsedRewrite[] = [];
  if (sections['3']) {
    for (const r of parseTable(sections['3'])) {
      const { tag, warn } = extractTag(r[3] ?? '');
      if (warn) warnings.push(`[3.rewrite] ${warn}`);
      rewrites.push({ user_expr: r[0] ?? '', native_version: r[1] ?? '', nuance: r[2] ?? '', tag });
    }
  }

  // 4. 반복 패턴 (강점 bullets + 약점 table)
  const patterns: ParsedPattern[] = [];
  if (sections['4']) {
    const body = sections['4'];
    const wIdx = body.indexOf('### 약점');
    const sIdx = body.indexOf('### 강점');
    const strengthsBody = sIdx >= 0 ? body.slice(sIdx, wIdx >= 0 ? wIdx : undefined) : '';
    const weaknessBody = wIdx >= 0 ? body.slice(wIdx) : '';
    strengthsBody.split('\n')
      .filter(l => /^[-*]\s+/.test(l.trim()))
      .forEach(l => patterns.push({
        type: 'strength', description: l.trim().replace(/^[-*]\s+/, ''),
        canonical_tag: null, severity: null,
      }));
    for (const r of parseTable(weaknessBody)) {
      const { tag, warn } = extractTag(r[1] ?? '');
      if (warn) warnings.push(`[4.약점] ${warn}`);
      patterns.push({
        type: 'weakness', description: r[0] ?? '',
        canonical_tag: tag, severity: validSeverity(r[2] ?? ''),
      });
    }
  }

  // 5. 추천 Phrase
  // 표 형식: phrase | meaning | example | tags (4칸, 기존) 또는
  //          phrase | meaning | note | example | tags (5칸, note=피드백/뉘앙스 포함)
  const phrases: ParsedPhrase[] = [];
  if (sections['5']) {
    for (const r of parseTable(sections['5'])) {
      const hasNote = r.length >= 5;
      const tagCell = hasNote ? r[4] : r[3];
      const { tags, warns } = extractTags(tagCell ?? '');
      warns.forEach(w => warnings.push(`[5.phrase] ${w}`));
      phrases.push({
        phrase: r[0] ?? '', meaning: r[1] ?? '',
        note: hasNote ? r[2] ?? '' : '',
        example: hasNote ? r[3] ?? '' : r[2] ?? '',
        tags,
      });
    }
  }

  // 6. 능동 어휘
  // 표 형식: word | meaning | tags (3칸, 기존) 또는
  //          word | meaning | note | tags (4칸, note=피드백/뉘앙스 포함)
  const vocab: ParsedVocab[] = [];
  if (sections['6']) {
    for (const r of parseTable(sections['6'])) {
      const hasNote = r.length >= 4;
      const tagCell = hasNote ? r[3] : r[2];
      const { tags, warns } = extractTags(tagCell ?? '');
      warns.forEach(w => warnings.push(`[6.vocab] ${w}`));
      vocab.push({
        word: r[0] ?? '', meaning: r[1] ?? '',
        note: hasNote ? r[2] ?? '' : '',
        tags,
      });
    }
  }

  // 7. Next Session
  const actions: ParsedAction[] = [];
  if (sections['7']) {
    for (const r of parseTable(sections['7'])) {
      const { tag, warn } = extractTag(r[1] ?? '');
      if (warn) warnings.push(`[7.action] ${warn}`);
      actions.push({ suggestion: r[0] ?? '', target_tag: tag });
    }
  }

  return {
    ok: true, errors, warnings,
    data: { raw, meta, missions, corrections, transcription_suspects, rewrites, patterns, phrases, vocab, actions },
  };
}
