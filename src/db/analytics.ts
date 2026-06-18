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

// ── Phase 2 추가 ──────────────────────────────────────────────

export interface SessionTrendPoint {
  sessionId: string;
  date: string;
  topic: string;
  correctionCount: number;
  phraseCount: number;
}

// 최근 N 세션의 교정 건수 추이 (시계열 트렌드)
export async function sessionTrend(limit = 10): Promise<SessionTrendPoint[]> {
  const sessions = await db.sessions.orderBy('date').reverse().limit(limit).toArray();
  const ids = sessions.map(s => s.id);

  const [corrections, phrases] = await Promise.all([
    db.corrections.where('session_id').anyOf(ids).toArray(),
    db.phrases.where('first_seen_session_id').anyOf(ids).toArray(),
  ]);

  const corrMap = new Map<string, number>();
  corrections.forEach(c => corrMap.set(c.session_id, (corrMap.get(c.session_id) ?? 0) + 1));
  const phraseMap = new Map<string, number>();
  phrases.forEach(p => phraseMap.set(p.first_seen_session_id, (phraseMap.get(p.first_seen_session_id) ?? 0) + 1));

  return sessions
    .reverse() // 날짜 오름차순으로 반환
    .map(s => ({
      sessionId: s.id,
      date: s.date,
      topic: s.topic,
      correctionCount: corrMap.get(s.id) ?? 0,
      phraseCount: phraseMap.get(s.id) ?? 0,
    }));
}

export interface MasteryDist {
  box: number;
  phraseCount: number;
  vocabCount: number;
  total: number;
}

// SRS Box(1~5) 별 분포 — 마스터리 진행도
export async function masteryDistribution(): Promise<MasteryDist[]> {
  const [phrases, vocab] = await Promise.all([
    db.phrases.toArray(),
    db.vocab.toArray(),
  ]);
  const boxes: MasteryDist[] = [1, 2, 3, 4, 5].map(box => ({ box, phraseCount: 0, vocabCount: 0, total: 0 }));
  phrases.forEach(p => {
    const b = Math.min(Math.max(p.srs_box, 1), 5) - 1;
    boxes[b].phraseCount++;
    boxes[b].total++;
  });
  vocab.forEach(v => {
    const b = Math.min(Math.max(v.srs_box, 1), 5) - 1;
    boxes[b].vocabCount++;
    boxes[b].total++;
  });
  return boxes;
}

// 아직 한 번도 실제 대화에서 사용하지 않은 Phrase (used_later_count === 0)
export async function unadoptedPhrases() {
  const all = await db.phrases.toArray();
  const unadopted = all.filter(p => p.used_later_count === 0);
  const adopted = all.filter(p => p.used_later_count > 0);
  return {
    total: all.length,
    unadoptedCount: unadopted.length,
    adoptedCount: adopted.length,
    // 최근 추천순으로 정렬 (미사용 우선)
    unadopted: unadopted
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 10),
    // 가장 많이 재사용한 Phrase
    topAdopted: adopted
      .sort((a, b) => b.used_later_count - a.used_later_count)
      .slice(0, 5),
  };
}

// 세션 상세: 해당 session_id의 모든 학습 데이터
export async function sessionDetail(sessionId: string) {
  const [session, corrections, rewrites, patterns, phrases, vocab, actions] = await Promise.all([
    db.sessions.get(sessionId),
    db.corrections.where('session_id').equals(sessionId).toArray(),
    db.rewrites.where('session_id').equals(sessionId).toArray(),
    db.patterns.where('session_id').equals(sessionId).toArray(),
    db.phrases.where('first_seen_session_id').equals(sessionId).toArray(),
    db.vocab.where('first_seen_session_id').equals(sessionId).toArray(),
    db.actions.where('session_id').equals(sessionId).toArray(),
  ]);
  return { session, corrections, rewrites, patterns, phrases, vocab, actions };
}

// 전체 세션 목록 (최신순)
export async function allSessions() {
  return db.sessions.orderBy('date').reverse().toArray();
}
