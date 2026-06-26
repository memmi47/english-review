// study.ts — 교정(correction)/Rewrite 복습 추적 (신규 보조 모듈)
//
// schema.ts/srs.ts 등 "검증된 규격" 파일은 그대로 두고, 별도의 Dexie DB에
// 복습 진행 상태(SRS box·다음 복습일)만 추가로 저장한다. 원본 7개 파일의
// 타입·로직은 건드리지 않고, 그 파일들이 export한 읽기 전용 API만 사용한다.
//
// 목적: LLM 코치가 제안한 교정 문장(corrections)·더 나은 표현(rewrites)도
// phrase/vocab과 동일한 Leitner 방식으로 "알았음/더 복습 필요"를 추적한다.
// 발음 평가는 불가능하므로 자기평가(모름/앎)만으로 다음 노출일을 정한다.

import Dexie, { type Table } from 'dexie';
import { db as mainDB, today, type CorrectionRow, type RewriteRow } from './schema';
import { schedule, type Grade } from './srs';

export type StudyKind = 'correction' | 'rewrite';

export interface StudyMarkRow {
  id: string; // `${kind}:${target_id}`
  kind: StudyKind;
  target_id: string;
  srs_box: number;
  due_date: string;
  reps: number;
}

class StudyMarksDB extends Dexie {
  marks!: Table<StudyMarkRow, string>;
  constructor() {
    super('EnglishReviewStudyMarksDB');
    this.version(1).stores({
      marks: 'id, kind, target_id, due_date',
    });
  }
}

export const studyDB = new StudyMarksDB();

const markId = (kind: StudyKind, targetId: string) => `${kind}:${targetId}`;

export type DueStudyItem =
  | { kind: 'correction'; row: CorrectionRow; isNew: boolean; dueDate: string }
  | { kind: 'rewrite'; row: RewriteRow; isNew: boolean; dueDate: string };

// 마크가 없으면(처음 등장) 오늘 바로 복습 대상으로 취급한다.
export async function dueStudyItems(): Promise<DueStudyItem[]> {
  const t = today();
  const [corrections, rewrites, marks] = await Promise.all([
    mainDB.corrections.toArray(),
    mainDB.rewrites.toArray(),
    studyDB.marks.toArray(),
  ]);
  const markMap = new Map(marks.map(m => [m.id, m]));
  const items: DueStudyItem[] = [];

  for (const row of corrections) {
    const mark = markMap.get(markId('correction', row.id));
    if (!mark || mark.due_date <= t) {
      items.push({ kind: 'correction', row, isNew: !mark, dueDate: mark?.due_date ?? t });
    }
  }
  for (const row of rewrites) {
    const mark = markMap.get(markId('rewrite', row.id));
    if (!mark || mark.due_date <= t) {
      items.push({ kind: 'rewrite', row, isNew: !mark, dueDate: mark?.due_date ?? t });
    }
  }
  return items.sort((a, b) => {
    if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
    return a.dueDate.localeCompare(b.dueDate);
  });
}

export async function reviewStudyItem(kind: StudyKind, targetId: string, grade: Grade): Promise<void> {
  const id = markId(kind, targetId);
  const current = await studyDB.marks.get(id);
  const { srs_box, due_date } = schedule(current?.srs_box ?? 1, grade);
  await studyDB.marks.put({
    id, kind, target_id: targetId, srs_box, due_date, reps: (current?.reps ?? 0) + 1,
  });
}
