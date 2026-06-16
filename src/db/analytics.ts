// analytics.ts — 앱이 계산하는 파생 KPI (규격서 4절)
// 코치가 아닌 DB가 교차 세션 분석을 담당한다.

import { db, today } from './schema';

export interface TagStat { tag: string; count: number; lastSeen: string | null; }

// 재발률: canonical_tag별 출현 빈도(교정 + 약점 패턴)
export async function tagRecurrence(): Promise<TagStat[]> {
  const [corr, pat, sessions] = await Promise.all([
    db.corrections.toArray(),
    db.patterns.where('type').equals('weakness').toArray(),
    db.sessions.toArray(),
  ]);
  const sDate = new Map(sessions.map(s => [s.id, s.date]));
  const counts = new Map<string, TagStat>();
  const bump = (tag: string | null | undefined, sid: string) => {
    if (!tag || tag === 'unmapped') return;
    const d = sDate.get(sid) ?? null;
    const c = counts.get(tag) ?? { tag, count: 0, lastSeen: null };
    c.count++;
    if (!c.lastSeen || (d && d > c.lastSeen)) c.lastSeen = d;
    counts.set(tag, c);
  };
  corr.forEach(c => bump(c.error_tag, c.session_id));
  pat.forEach(p => bump(p.canonical_tag, p.session_id));
  return [...counts.values()].sort((a, b) => b.count - a.count);
}

// Phrase 사용률
export async function phraseAdoption() {
  const all = await db.phrases.toArray();
  const adopted = all.filter(p => p.used_later_count > 0);
  return {
    total: all.length,
    adopted: adopted.length,
    rate: all.length ? adopted.length / all.length : 0,
    items: all.map(p => ({ phrase: p.phrase, used_later_count: p.used_later_count }))
      .sort((a, b) => b.used_later_count - a.used_later_count),
  };
}

// 미션 이행률
export async function missionCompletion() {
  const a = await db.actions.toArray();
  const done = a.filter(x => x.completed).length;
  return { total: a.length, completed: done, rate: a.length ? done / a.length : 0 };
}

// 오늘 복습 예정(SRS due) — 내재화 큐
export async function dueForReview() {
  const t = today();
  const [phrases, vocab] = await Promise.all([
    db.phrases.where('due_date').belowOrEqual(t).toArray(),
    db.vocab.where('due_date').belowOrEqual(t).toArray(),
  ]);
  return { phrases, vocab, count: phrases.length + vocab.length };
}
