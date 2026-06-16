// ingest.ts — 파싱 결과를 DB에 무손실 누적
// 핵심: 중복 제거 / phrase 사용률 스캔 / 미션 이행 교차 갱신

import { db, newId, today, normalize } from './schema';
import type { ParsedReport } from './parser';

export interface IngestResult {
  sessionId: string;
  added: { phrases: number; vocab: number; corrections: number; rewrites: number; patterns: number; actions: number; suspects: number };
  adoptionBumps: number;     // 이번 세션에서 사용 확인된 기존 phrase 수
  missionsClosed: number;    // 이행으로 마감된 이전 액션 수
}

export async function ingestReport(parsed: ParsedReport): Promise<IngestResult> {
  return db.transaction('rw', db.tables, async () => {
    const sessionId = newId();
    const nowIso = new Date().toISOString();
    const date = parsed.meta.date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.meta.date) ? parsed.meta.date : today();

    // 원문 보존 (규칙 8)
    await db.sessions.add({
      id: sessionId, date, topic: parsed.meta.topic ?? '',
      duration_min: parsed.meta.duration_min ?? null, raw_report: parsed.raw, created_at: nowIso,
    });

    await db.corrections.bulkAdd(parsed.corrections.map(c => ({ id: newId(), session_id: sessionId, ...c })));
    await db.transcription_suspects.bulkAdd(parsed.transcription_suspects.map(t => ({ id: newId(), session_id: sessionId, ...t })));
    await db.rewrites.bulkAdd(parsed.rewrites.map(r => ({ id: newId(), session_id: sessionId, ...r })));
    await db.patterns.bulkAdd(parsed.patterns.map(p => ({ id: newId(), session_id: sessionId, ...p })));
    await db.actions.bulkAdd(parsed.actions.map(a => ({ id: newId(), session_id: sessionId, completed: false, ...a })));

    // 미션 이행 교차: 이번 리포트 0번 섹션의 '달성/부분'을 이전 미완료 액션과 매칭(best-effort)
    let missionsClosed = 0;
    if (parsed.missions.length) {
      const open = await db.actions.filter(a => !a.completed && a.session_id !== sessionId).toArray();
      for (const m of parsed.missions) {
        if (!/달성|부분/.test(m.status)) continue;
        const nm = normalize(m.mission);
        if (!nm) continue;
        const hit = open.find(a => { const na = normalize(a.suggestion); return na && (nm.includes(na) || na.includes(nm)); });
        if (hit) { await db.actions.update(hit.id, { completed: true }); missionsClosed++; }
      }
    }

    // phrase 사용률 스캔: 이전 세션에서 추천된 phrase가 이번 raw_report에 등장하면 +1
    let adoptionBumps = 0;
    const normRaw = normalize(parsed.raw);
    const existingPhrases = await db.phrases.toArray();
    for (const p of existingPhrases) {
      if (p.first_seen_session_id === sessionId) continue;
      if (p.norm && normRaw.includes(p.norm)) { await db.phrases.update(p.id, { used_later_count: p.used_later_count + 1 }); adoptionBumps++; }
    }

    // 신규 phrase 적재(정규화 키로 중복 제거)
    let addedPhrases = 0;
    for (const ph of parsed.phrases) {
      const n = normalize(ph.phrase);
      if (!n) continue;
      const dup = await db.phrases.where('norm').equals(n).first();
      if (dup) continue;
      await db.phrases.add({
        id: newId(), norm: n, phrase: ph.phrase, meaning: ph.meaning, example: ph.example, tags: ph.tags,
        first_seen_session_id: sessionId, srs_box: 1, reps: 0, used_later_count: 0, due_date: today(), created_at: nowIso,
      });
      addedPhrases++;
    }

    // 신규 vocab 적재(중복 제거)
    let addedVocab = 0;
    for (const v of parsed.vocab) {
      const n = normalize(v.word);
      if (!n) continue;
      const dup = await db.vocab.where('norm').equals(n).first();
      if (dup) continue;
      await db.vocab.add({
        id: newId(), norm: n, word: v.word, meaning: v.meaning, tags: v.tags,
        first_seen_session_id: sessionId, srs_box: 1, due_date: today(), created_at: nowIso,
      });
      addedVocab++;
    }

    return {
      sessionId,
      added: {
        phrases: addedPhrases, vocab: addedVocab, corrections: parsed.corrections.length,
        rewrites: parsed.rewrites.length, patterns: parsed.patterns.length, actions: parsed.actions.length,
        suspects: parsed.transcription_suspects.length,
      },
      adoptionBumps, missionsClosed,
    };
  });
}
