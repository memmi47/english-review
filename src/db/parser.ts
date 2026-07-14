// parser.ts — 리포트 파서 (규격서 v3 JSON 전용)
// 입력: JSON 코드 블록이 포함된 텍스트 → 출력: 구조화된 ParsedReport

import { CANONICAL_TAGS, SEVERITIES, type CanonicalTag, type TagValue, type Severity } from './schema';

// --- Parsed shapes (ingest가 id·session_id를 부여) ---
export interface ParsedCorrection { original: string; intended_meaning?: string; corrected: string; rule: string; error_tag: TagValue; severity: Severity | null; }
export interface ParsedSuspect { heard: string; intended: string; }
export interface ParsedRewrite { user_expr: string; intended_meaning?: string; native_version: string; nuance: string; tag: TagValue; }
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

// [tag] 형태의 문자열에서 대괄호를 제거하고 유효성 검사
function extractTag(val: string | null | undefined): { tag: TagValue; warn?: string } {
  if (!val) return { tag: null };
  const t = val.replace(/^\[|\]$/g, '').toLowerCase().trim();
  if (!t) return { tag: null };
  if ((CANONICAL_TAGS as readonly string[]).includes(t)) return { tag: t as CanonicalTag };
  return { tag: 'unmapped', warn: `미등재 태그 [${t}] — 검수 필요` };
}

// 태그 배열 유효성 검사
function extractTags(arr: string[] | string | null | undefined): { tags: (CanonicalTag | 'unmapped')[]; warns: string[] } {
  if (!arr) return { tags: [], warns: [] };
  const rawTags = Array.isArray(arr) ? arr : [arr];
  const tags: (CanonicalTag | 'unmapped')[] = [];
  const warns: string[] = [];

  for (const val of rawTags) {
    if (!val) continue;
    const t = val.replace(/^\[|\]$/g, '').toLowerCase().trim();
    if (!t) continue;
    if ((CANONICAL_TAGS as readonly string[]).includes(t)) {
      tags.push(t as CanonicalTag);
    } else {
      tags.push('unmapped');
      warns.push(`미등재 태그 [${t}] — 검수 필요`);
    }
  }
  return { tags, warns };
}

// Severity 유효성 검사
function validSeverity(val: string | null | undefined): Severity | null {
  if (!val) return null;
  return (SEVERITIES as readonly string[]).find(s => val.includes(s)) as Severity | undefined ?? null;
}

// JSON 추출기: 마크다운 코드 블록 내부의 JSON을 찾거나, 전체가 JSON인지 확인
function extractJsonString(raw: string): string | null {
  const codeBlockMatch = raw.match(/```json\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1];
  }
  const plainBlockMatch = raw.match(/```\s*(\{[\s\S]*?\})\s*```/);
  if (plainBlockMatch) {
    return plainBlockMatch[1];
  }
  // 블록이 없으면 전체 텍스트가 JSON일 수 있으므로 시도
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }
  return null;
}

// --- Main ---
export function parseReport(raw: string): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const jsonString = extractJsonString(raw);
  if (!jsonString) {
    return {
      ok: false,
      errors: ['JSON 데이터를 찾을 수 없습니다. 리포트가 ` ```json ... ``` ` 포맷으로 작성되었는지 확인하세요.'],
      warnings
    };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e: any) {
    return { ok: false, errors: [`JSON 파싱 에러: ${e.message}`], warnings };
  }

  // 데이터 검증 및 매핑
  const meta = parsed.meta || {};
  if (!meta.date) warnings.push('메타 날짜(date)가 없습니다. 오늘 날짜로 대체됩니다.');
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) warnings.push(`날짜 형식 비정상: "${meta.date}"`);

  // Missions
  const missions: ParsedMission[] = (parsed.missions || []).map((m: any) => ({
    mission: m.mission || '',
    status: m.status || ''
  }));

  // Corrections
  const corrections: ParsedCorrection[] = (parsed.corrections || []).map((c: any) => {
    const { tag, warn } = extractTag(c.error_tag);
    if (warn) warnings.push(`[교정] ${warn}`);
    return {
      original: c.original || '',
      intended_meaning: c.intended_meaning, // v3 신규 필드
      corrected: c.corrected || '',
      rule: c.rule || '',
      error_tag: tag,
      severity: validSeverity(c.severity)
    };
  });

  // Transcription Suspects
  const transcription_suspects: ParsedSuspect[] = (parsed.transcription_suspects || []).map((s: any) => ({
    heard: s.heard || '',
    intended: s.intended || ''
  }));

  // Rewrites
  const rewrites: ParsedRewrite[] = (parsed.rewrites || []).map((r: any) => {
    const { tag, warn } = extractTag(r.tag);
    if (warn) warnings.push(`[Rewrite] ${warn}`);
    return {
      user_expr: r.user_expr || '',
      intended_meaning: r.intended_meaning, // v3 신규 필드
      native_version: r.native_version || '',
      nuance: r.nuance || '',
      tag
    };
  });

  // Patterns
  const patterns: ParsedPattern[] = (parsed.patterns || []).map((p: any) => {
    const { tag, warn } = extractTag(p.canonical_tag);
    if (warn) warnings.push(`[패턴] ${warn}`);
    return {
      type: p.type === 'strength' || p.type === 'weakness' ? p.type : 'weakness',
      description: p.description || '',
      canonical_tag: tag,
      severity: validSeverity(p.severity)
    };
  });

  // Phrases
  const phrases: ParsedPhrase[] = (parsed.phrases || []).map((p: any) => {
    const { tags, warns } = extractTags(p.tags);
    warns.forEach(w => warnings.push(`[Phrase] ${w}`));
    return {
      phrase: p.phrase || '',
      meaning: p.meaning || '',
      note: p.note || '',
      example: p.example || '',
      tags
    };
  });

  // Vocab
  const vocab: ParsedVocab[] = (parsed.vocab || []).map((v: any) => {
    const { tags, warns } = extractTags(v.tags);
    warns.forEach(w => warnings.push(`[어휘] ${w}`));
    return {
      word: v.word || '',
      meaning: v.meaning || '',
      note: v.note || '',
      tags
    };
  });

  // Actions
  const actions: ParsedAction[] = (parsed.actions || []).map((a: any) => {
    const { tag, warn } = extractTag(a.target_tag);
    if (warn) warnings.push(`[액션] ${warn}`);
    return {
      suggestion: a.suggestion || '',
      target_tag: tag
    };
  });

  return {
    ok: true,
    errors,
    warnings,
    data: {
      raw, // 원본 텍스트 전체 보존
      meta: {
        date: meta.date || null,
        topic: meta.topic || null,
        duration_min: typeof meta.duration_min === 'number' ? meta.duration_min : null
      },
      missions,
      corrections,
      transcription_suspects,
      rewrites,
      patterns,
      phrases,
      vocab,
      actions
    }
  };
}
