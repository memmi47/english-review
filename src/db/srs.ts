// srs.ts — Leitner 간격 반복 (규격서: SRS는 phrase/어휘 암기에만 제한 적용)

import { db } from './schema';

// box 1~5 → 다음 복습까지 일수
const BOX_INTERVALS = [1, 2, 4, 7, 15];

export type Grade = 'again' | 'good';

export function schedule(box: number, grade: Grade): { srs_box: number; due_date: string } {
  const nb = grade === 'again' ? 1 : Math.min(box + 1, BOX_INTERVALS.length);
  const interval = BOX_INTERVALS[nb - 1];
  const d = new Date();
  d.setDate(d.getDate() + interval);
  return { srs_box: nb, due_date: d.toISOString().slice(0, 10) };
}

export async function reviewPhrase(id: string, grade: Grade): Promise<void> {
  const p = await db.phrases.get(id);
  if (!p) return;
  const { srs_box, due_date } = schedule(p.srs_box, grade);
  await db.phrases.update(id, { srs_box, due_date, reps: p.reps + 1 });
}

export async function reviewVocab(id: string, grade: Grade): Promise<void> {
  const v = await db.vocab.get(id);
  if (!v) return;
  const { srs_box, due_date } = schedule(v.srs_box, grade);
  await db.vocab.update(id, { srs_box, due_date, reps: (v.reps ?? 0) + 1 });
}
