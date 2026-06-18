// schema.ts — IndexedDB(Dexie) 스키마 및 공통 타입
// 규격서 v2의 데이터 모델·태그 사전에 1:1 대응한다.

import Dexie, { type Table } from 'dexie';

export const SCHEMA_VERSION = 2;

// --- Controlled Vocabulary (규격서 3절) ---
export const CANONICAL_TAGS = [
  'articles', 'sva', 'verbal-noun', 'tense', 'preposition', 'plural',
  'question-form', 'word-choice', 'collocation', 'register',
  'redundancy', 'fragmentation', 'filler', 'pronunciation',
] as const;
export type CanonicalTag = typeof CANONICAL_TAGS[number];
export type TagValue = CanonicalTag | 'unmapped' | null;

export const SEVERITIES = ['일회성', '반복', '화석화'] as const;
export type Severity = typeof SEVERITIES[number];

// --- Table row interfaces ---
export interface SessionRow {
  id: string;
  date: string;            // 'YYYY-MM-DD'
  topic: string;
  duration_min: number | null;
  raw_report: string;      // 붙여넣은 리포트 원문 전체 보존
  created_at: string;      // ISO timestamp
}

export interface PhraseRow {
  id: string;
  norm: string;            // 정규화 키(중복 판정)
  phrase: string;
  meaning: string;
  note: string;            // 피드백/뉘앙스(이 표현을 추천한 이유) — meaning(실제 뜻)과는 별개
  example: string;
  tags: (CanonicalTag | 'unmapped')[];
  first_seen_session_id: string;
  srs_box: number;         // Leitner 1~5
  reps: number;
  used_later_count: number;// 이후 세션 등장 횟수(사용률)
  due_date: string;        // 'YYYY-MM-DD'
  created_at: string;
}

export interface VocabRow {
  id: string;
  norm: string;
  word: string;
  meaning: string;
  note: string;            // 피드백/뉘앙스 — meaning(실제 뜻)과는 별개
  tags: (CanonicalTag | 'unmapped')[];
  first_seen_session_id: string;
  srs_box: number;
  due_date: string;
  created_at: string;
}

export interface RewriteRow {
  id: string;
  session_id: string;
  user_expr: string;
  intended_meaning?: string;
  native_version: string;
  nuance: string;
  tag: TagValue;
}

export interface CorrectionRow {
  id: string;
  session_id: string;
  original: string;
  intended_meaning?: string;
  corrected: string;
  rule: string;
  error_tag: TagValue;
  severity: Severity | null;
}

export interface PatternRow {
  id: string;
  session_id: string;
  type: 'strength' | 'weakness';
  description: string;
  canonical_tag: TagValue;
  severity: Severity | null;
}

export interface ActionRow {
  id: string;
  session_id: string;
  suggestion: string;
  target_tag: TagValue;
  completed: boolean;
}

export interface TranscriptionSuspectRow {
  id: string;
  session_id: string;
  heard: string;
  intended: string;
}

// --- Dexie class ---
export class ReviewDB extends Dexie {
  sessions!: Table<SessionRow, string>;
  phrases!: Table<PhraseRow, string>;
  vocab!: Table<VocabRow, string>;
  rewrites!: Table<RewriteRow, string>;
  corrections!: Table<CorrectionRow, string>;
  patterns!: Table<PatternRow, string>;
  actions!: Table<ActionRow, string>;
  transcription_suspects!: Table<TranscriptionSuspectRow, string>;

  constructor() {
    super('EnglishReviewDB');
    this.version(1).stores({
      sessions: 'id, date, topic, created_at',
      phrases: 'id, norm, due_date, srs_box, first_seen_session_id',
      vocab: 'id, norm, due_date, srs_box, first_seen_session_id',
      rewrites: 'id, session_id, tag',
      corrections: 'id, session_id, error_tag, severity',
      patterns: 'id, session_id, type, canonical_tag',
      actions: 'id, session_id, completed, target_tag',
      transcription_suspects: 'id, session_id',
    });
    // v2: intended_meaning 추가 (인덱스 불필요하여 스토어 정의는 동일)
    this.version(2).stores({});
  }
}

export const db = new ReviewDB();

// --- Utilities ---
export const newId = (): string => crypto.randomUUID();
export const today = (): string => new Date().toISOString().slice(0, 10);
export const normalize = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9가-힣]+/g, ' ').trim();
