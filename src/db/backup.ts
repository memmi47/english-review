// backup.ts — 디바이스 백업/복원 (Option C: 로컬 우선 + 무손실 백업)
// iOS Safari/PWA에서 IndexedDB 유실 위험에 대비해 JSON 스냅샷을 파일 앱/iCloud Drive에 보관.

import { db, SCHEMA_VERSION, today } from './schema';

const TABLES = [
  'sessions', 'phrases', 'vocab', 'rewrites',
  'corrections', 'patterns', 'actions', 'transcription_suspects',
] as const;

export interface BackupFile {
  schema_version: number;
  exported_at: string;
  data: Record<string, unknown[]>;
}

// 전체 DB → JSON 문자열
export async function exportAll(): Promise<string> {
  const data: Record<string, unknown[]> = {};
  for (const t of TABLES) data[t] = await (db as any)[t].toArray();
  const file: BackupFile = { schema_version: SCHEMA_VERSION, exported_at: new Date().toISOString(), data };
  return JSON.stringify(file, null, 2);
}

// 다운로드 트리거. iOS는 다운로드 후 '파일에 저장 → iCloud Drive' 흐름.
// 공유 시트가 더 자연스러우면 navigator.share(파일 지원 기기)로 대체 가능.
export async function downloadBackup(): Promise<void> {
  const json = await exportAll();
  const fileName = `english-review-backup-${today()}.json`;
  const blob = new Blob([json], { type: 'application/json' });

  const navAny = navigator as any;
  if (navAny.canShare && typeof File !== 'undefined') {
    const file = new File([blob], fileName, { type: 'application/json' });
    if (navAny.canShare({ files: [file] })) {
      try { await navAny.share({ files: [file], title: fileName }); return; }
      catch (e) {
        if ((e as any)?.name === 'AbortError') return; // 사용자가 공유 시트를 직접 취소한 경우
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
    if (mode === 'replace') for (const t of TABLES) await (db as any)[t].clear();
    for (const t of TABLES) {
      const rows = (parsed.data[t] ?? []) as any[];
      let n = 0;
      if (mode === 'replace') { await (db as any)[t].bulkAdd(rows); n = rows.length; }
      else for (const row of rows) { const ex = await (db as any)[t].get(row.id); if (!ex) { await (db as any)[t].add(row); n++; } }
      imported[t] = n;
    }
  });
  return { imported };
}

// 마지막 백업 경과 안내용 (자동 백업 리마인드 배너에 사용)
export function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}
