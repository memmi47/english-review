// streak.ts — 연속 학습일 & 히트맵 계산

import { db } from './schema';

// 최근 N일 학습 여부 맵 { 'YYYY-MM-DD': boolean }
export async function getStudyHeatmap(days = 70): Promise<Record<string, boolean>> {
  const sessions = await db.sessions.toArray();
  const dateSet = new Set(sessions.map(s => s.date));
  const map: Record<string, boolean> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    map[key] = dateSet.has(key);
  }
  return map;
}

// 오늘 기준 연속 학습일 계산 (오늘 리포트가 없어도 어제까지 연속이면 유지)
export async function getStreakInfo(): Promise<{
  streak: number;       // 현재 연속 학습일
  longestStreak: number;
  studiedToday: boolean;
}> {
  const sessions = await db.sessions.toArray();
  const dateSet = new Set(sessions.map(s => s.date));

  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const studiedToday = dateSet.has(fmt(today));

  // 어제부터 거슬러 올라가며 연속 계산 (오늘 미학습이어도 어제까지 연속이면 streak 유지)
  let streak = studiedToday ? 1 : 0;
  let cur = new Date(today);
  cur.setDate(cur.getDate() - 1); // 어제부터 시작

  while (dateSet.has(fmt(cur))) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }

  // 최장 스트릭 계산
  const sorted = [...dateSet].sort();
  let longest = 0, run = 0, prev: string | null = null;
  for (const d of sorted) {
    if (prev) {
      const diff = (new Date(d).getTime() - new Date(prev).getTime()) / 86400000;
      if (diff === 1) { run++; } else { run = 1; }
    } else { run = 1; }
    if (run > longest) longest = run;
    prev = d;
  }

  return { streak, longestStreak: longest, studiedToday };
}

// 오늘 세션이 있는지 (임포트 완료 여부)
export async function hasSessionToday(): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const count = await db.sessions.where('date').equals(today).count();
  return count > 0;
}
