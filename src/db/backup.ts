// backup.ts — 디바이스 백업/복원 (Option C: 로컬 우선 + 무손실 백업)
// iOS Safari/PWA에서 IndexedDB 유실 위험에 대비해 JSON 스냅샷을 파일 앱/iCloud Drive에 보관.

import { db, SCHEMA_VERSION, today } from './schema';
import type {
  ActionRow, CorrectionRow, PatternRow, PhraseRow, RewriteRow, SessionRow,
  TranscriptionSuspectRow, VocabRow,
} from './schema';
import { studyDB, type StudyMarkRow } from './study';
import type { Table } from 'dexie';

const TABLES = [
  'sessions', 'phrases', 'vocab', 'rewrites',
  'corrections', 'patterns', 'actions', 'transcription_suspects',
] as const;

type TableRows = {
  sessions: SessionRow;
  phrases: PhraseRow;
  vocab: VocabRow;
  rewrites: RewriteRow;
  corrections: CorrectionRow;
  patterns: PatternRow;
  actions: ActionRow;
  transcription_suspects: TranscriptionSuspectRow;
};
type RowWithId = { id: string };

export interface BackupFile {
  schema_version: number;
  exported_at: string;
  data: Record<string, unknown[]>;
}

function rowsFromBackup<T extends RowWithId>(data: Record<string, unknown[]>, key: string): T[] {
  const rows = data[key];
  return Array.isArray(rows) ? rows as T[] : [];
}

async function importRows<T extends RowWithId>(
  table: Table<T, string>,
  rows: T[],
  mode: 'merge' | 'replace',
): Promise<number> {
  if (mode === 'replace') {
    await table.bulkAdd(rows);
    return rows.length;
  }

  let n = 0;
  for (const row of rows) {
    const ex = await table.get(row.id);
    if (!ex) {
      await table.add(row);
      n++;
    }
  }
  return n;
}

async function importMainTable<T extends RowWithId>(
  imported: Record<string, number>,
  data: Record<string, unknown[]>,
  key: string,
  table: Table<T, string>,
  mode: 'merge' | 'replace',
): Promise<void> {
  const rows = rowsFromBackup<T>(data, key);
  imported[key] = await importRows(table, rows, mode);
}

// 전체 DB → JSON 문자열
export async function exportAll(): Promise<string> {
  const data: Record<string, unknown[]> = {};
  data.sessions = await db.sessions.toArray();
  data.phrases = await db.phrases.toArray();
  data.vocab = await db.vocab.toArray();
  data.rewrites = await db.rewrites.toArray();
  data.corrections = await db.corrections.toArray();
  data.patterns = await db.patterns.toArray();
  data.actions = await db.actions.toArray();
  data.transcription_suspects = await db.transcription_suspects.toArray();
  data.study_marks = await studyDB.marks.toArray();
  const file: BackupFile = { schema_version: SCHEMA_VERSION, exported_at: new Date().toISOString(), data };
  return JSON.stringify(file, null, 2);
}

// 다운로드 트리거. iOS는 다운로드 후 '파일에 저장 → iCloud Drive' 흐름.
// 공유 시트가 더 자연스러우면 navigator.share(파일 지원 기기)로 대체 가능.
export async function downloadBackup(): Promise<void> {
  const json = await exportAll();
  const fileName = `english-review-backup-${today()}.json`;
  const blob = new Blob([json], { type: 'application/json' });

  if (navigator.canShare && navigator.share && typeof File !== 'undefined') {
    const file = new File([blob], fileName, { type: 'application/json' });
    const shareData: ShareData = { files: [file], title: fileName };
    if (navigator.canShare(shareData)) {
      try { await navigator.share(shareData); return; }
      catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return; // 사용자가 공유 시트를 직접 취소한 경우
        // iOS Safari: DB 조회 대기 후 호출되면 사용자 활성화가 풀려 NotAllowedError 발생 가능 → 다운로드로 대체
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName; a.click();
  URL.revokeObjectURL(url);
}

// 복원: merge(기존 id 보존, 신규만 추가) 또는 replace(전체 교체)
export async function importAll(json: string, mode: 'merge' | 'replace'): Promise<{ imported: Record<string, number> }> {
  const parsed = JSON.parse(json) as BackupFile;
  if (typeof parsed.schema_version !== 'number') throw new Error('백업 파일 형식이 아닙니다.');
  if (parsed.schema_version > SCHEMA_VERSION) {
    throw new Error(`백업 파일의 버전(v${parsed.schema_version})이 현재 앱(v${SCHEMA_VERSION})보다 높습니다. 앱을 업데이트해주세요.`);
  }
  const imported: Record<string, number> = {};
  await db.transaction('rw', db.tables, async () => {
    if (mode === 'replace') {
      for (const t of TABLES) await db.table(t).clear();
    }
    await importMainTable<TableRows['sessions']>(imported, parsed.data, 'sessions', db.sessions, mode);
    await importMainTable<TableRows['phrases']>(imported, parsed.data, 'phrases', db.phrases, mode);
    await importMainTable<TableRows['vocab']>(imported, parsed.data, 'vocab', db.vocab, mode);
    await importMainTable<TableRows['rewrites']>(imported, parsed.data, 'rewrites', db.rewrites, mode);
    await importMainTable<TableRows['corrections']>(imported, parsed.data, 'corrections', db.corrections, mode);
    await importMainTable<TableRows['patterns']>(imported, parsed.data, 'patterns', db.patterns, mode);
    await importMainTable<TableRows['actions']>(imported, parsed.data, 'actions', db.actions, mode);
    await importMainTable<TableRows['transcription_suspects']>(imported, parsed.data, 'transcription_suspects', db.transcription_suspects, mode);
  });

  const studyRows = rowsFromBackup<StudyMarkRow>(parsed.data, 'study_marks');
  if (studyRows.length > 0) {
    if (mode === 'replace') await studyDB.marks.clear();
    imported.study_marks = await importRows(studyDB.marks, studyRows, mode);
  } else {
    // 새 피드백 파일에는 학습 기록이 없을 수 있으므로 기존 연습 이력은 유지한다.
    imported.study_marks = 0;
  }
  return { imported };
}

// 마지막 백업 경과 안내용 (자동 백업 리마인드 배너에 사용)
export function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}
