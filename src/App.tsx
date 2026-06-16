import { useEffect, useRef, useState } from 'react'
import { parseReport, ingestReport, downloadBackup, importAll, db } from './db'
import type { IngestResult } from './db'

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; messages: string[] }
  | { kind: 'done'; result: IngestResult; warnings: string[] }

type BackupStatus =
  | { kind: 'idle' }
  | { kind: 'exporting' }
  | { kind: 'importing' }
  | { kind: 'error'; message: string }
  | { kind: 'imported'; counts: Record<string, number> }

interface Counts {
  sessions: number
  phrases: number
  vocab: number
  corrections: number
}

export default function App() {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [backupStatus, setBackupStatus] = useState<BackupStatus>({ kind: 'idle' })
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge')
  const [counts, setCounts] = useState<Counts | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function refreshCounts() {
    const [sessions, phrases, vocab, corrections] = await Promise.all([
      db.sessions.count(), db.phrases.count(), db.vocab.count(), db.corrections.count(),
    ])
    setCounts({ sessions, phrases, vocab, corrections })
  }

  useEffect(() => { refreshCounts() }, [])

  async function handleSave() {
    const trimmed = text.trim()
    if (!trimmed) return

    setStatus({ kind: 'loading' })
    try {
      const parsed = parseReport(trimmed)
      if (!parsed.ok || !parsed.data) {
        setStatus({ kind: 'error', messages: parsed.errors })
        return
      }
      const result = await ingestReport(parsed.data)
      setStatus({ kind: 'done', result, warnings: parsed.warnings })
      await refreshCounts()
    } catch (e) {
      setStatus({ kind: 'error', messages: [String(e)] })
    }
  }

  async function handleExport() {
    setBackupStatus({ kind: 'exporting' })
    try {
      await downloadBackup()
      setBackupStatus({ kind: 'idle' })
    } catch (e) {
      setBackupStatus({ kind: 'error', message: String(e) })
    }
  }

  async function handleImportFile(file: File) {
    setBackupStatus({ kind: 'importing' })
    try {
      const text = await file.text()
      const { imported } = await importAll(text, importMode)
      setBackupStatus({ kind: 'imported', counts: imported })
      await refreshCounts()
    } catch (e) {
      setBackupStatus({ kind: 'error', message: String(e) })
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>📋 리포트 가져오기</h1>
        <p style={styles.subtitle}>코치 리포트를 아래에 붙여넣고 저장하세요.</p>

        <textarea
          style={styles.textarea}
          placeholder="리포트 전문을 여기에 붙여넣으세요..."
          value={text}
          onChange={e => { setText(e.target.value); setStatus({ kind: 'idle' }) }}
        />

        <button
          style={{
            ...styles.button,
            opacity: status.kind === 'loading' ? 0.6 : 1,
          }}
          onClick={handleSave}
          disabled={status.kind === 'loading' || text.trim() === ''}
        >
          {status.kind === 'loading' ? '저장 중...' : 'DB에 저장'}
        </button>

        {status.kind === 'error' && (
          <div style={styles.errorBox}>
            <p style={styles.errorTitle}>⛔ 저장 실패</p>
            {status.messages.map((m, i) => (
              <p key={i} style={styles.errorMsg}>{m}</p>
            ))}
          </div>
        )}

        {status.kind === 'done' && (
          <div style={styles.resultBox}>
            <p style={styles.resultTitle}>✅ 저장 완료</p>
            <div style={styles.counts}>
              <CountBadge label="Phrase" value={status.result.added.phrases} />
              <CountBadge label="어휘" value={status.result.added.vocab} />
              <CountBadge label="교정" value={status.result.added.corrections} />
              <CountBadge label="Rewrite" value={status.result.added.rewrites} />
              <CountBadge label="액션" value={status.result.added.actions} />
            </div>
            {status.result.missionsClosed > 0 && (
              <p style={styles.missionNote}>
                미션 {status.result.missionsClosed}개 이행 완료 처리됨
              </p>
            )}
            {status.warnings.length > 0 && (
              <div style={styles.warnBox}>
                <p style={styles.warnTitle}>⚠️ 경고 ({status.warnings.length}건)</p>
                {status.warnings.map((w, i) => (
                  <p key={i} style={styles.warnMsg}>{w}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ ...styles.card, marginTop: '1rem' }}>
        <h2 style={styles.sectionTitle}>📊 저장된 데이터 현황</h2>
        <p style={styles.subtitle}>새로고침해도 이 숫자가 유지되면 정상 저장된 거예요.</p>
        {counts ? (
          <div style={styles.counts}>
            <CountBadge label="세션" value={counts.sessions} />
            <CountBadge label="Phrase" value={counts.phrases} />
            <CountBadge label="어휘" value={counts.vocab} />
            <CountBadge label="교정" value={counts.corrections} />
          </div>
        ) : (
          <p style={styles.subtitle}>불러오는 중...</p>
        )}
      </div>

      <div style={{ ...styles.card, marginTop: '1rem' }}>
        <h2 style={styles.sectionTitle}>💾 백업</h2>
        <p style={styles.subtitle}>기기 변경/삭제에 대비해 백업 파일을 보관하세요.</p>

        <button
          style={{ ...styles.button, opacity: backupStatus.kind === 'exporting' ? 0.6 : 1 }}
          onClick={handleExport}
          disabled={backupStatus.kind === 'exporting'}
        >
          {backupStatus.kind === 'exporting' ? '내보내는 중...' : '⬇️ 백업 내보내기'}
        </button>

        <div style={styles.divider} />

        <p style={styles.modeLabel}>가져오기 방식</p>
        <div style={styles.radioRow}>
          <label style={styles.radioLabel}>
            <input
              type="radio"
              checked={importMode === 'merge'}
              onChange={() => setImportMode('merge')}
            />
            병합(merge) — 기존 유지, 신규만 추가
          </label>
          <label style={styles.radioLabel}>
            <input
              type="radio"
              checked={importMode === 'replace'}
              onChange={() => setImportMode('replace')}
            />
            전체 교체(replace) — 기존 삭제 후 덮어쓰기
          </label>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleImportFile(f) }}
        />
        <button
          style={{
            ...styles.button,
            background: 'white',
            color: '#4f46e5',
            border: '1.5px solid #4f46e5',
            opacity: backupStatus.kind === 'importing' ? 0.6 : 1,
          }}
          onClick={() => fileInputRef.current?.click()}
          disabled={backupStatus.kind === 'importing'}
        >
          {backupStatus.kind === 'importing' ? '가져오는 중...' : '⬆️ 백업 가져오기'}
        </button>

        {backupStatus.kind === 'error' && (
          <div style={styles.errorBox}>
            <p style={styles.errorTitle}>⛔ 실패</p>
            <p style={styles.errorMsg}>{backupStatus.message}</p>
          </div>
        )}

        {backupStatus.kind === 'imported' && (
          <div style={styles.resultBox}>
            <p style={styles.resultTitle}>✅ 가져오기 완료</p>
            <div style={styles.counts}>
              {Object.entries(backupStatus.counts).map(([table, n]) => (
                <CountBadge key={table} label={table} value={n} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CountBadge({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.badge}>
      <span style={styles.badgeNum}>{value}</span>
      <span style={styles.badgeLabel}>{label}</span>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f5f5ff',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '1.5rem 1rem',
    boxSizing: 'border-box' as const,
  },
  card: {
    background: 'white',
    borderRadius: '1.25rem',
    padding: '1.5rem',
    boxShadow: '0 4px 20px rgba(79,70,229,0.1)',
    width: '100%',
    maxWidth: '480px',
    height: 'fit-content',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#4f46e5',
    margin: '0 0 0.25rem',
  },
  sectionTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#4f46e5',
    margin: '0 0 0.25rem',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#888',
    margin: '0 0 1rem',
  },
  textarea: {
    width: '100%',
    minHeight: '220px',
    padding: '0.75rem',
    borderRadius: '0.75rem',
    border: '1.5px solid #e0e0f0',
    fontSize: '0.875rem',
    fontFamily: 'monospace',
    resize: 'vertical' as const,
    boxSizing: 'border-box' as const,
    outline: 'none',
    color: '#333',
    lineHeight: 1.5,
  },
  button: {
    marginTop: '0.75rem',
    width: '100%',
    padding: '0.875rem',
    background: '#4f46e5',
    color: 'white',
    border: 'none',
    borderRadius: '0.75rem',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  errorBox: {
    marginTop: '1rem',
    background: '#fff0f0',
    border: '1px solid #fca5a5',
    borderRadius: '0.75rem',
    padding: '0.875rem',
  },
  errorTitle: {
    fontWeight: 700,
    color: '#dc2626',
    margin: '0 0 0.5rem',
    fontSize: '0.95rem',
  },
  errorMsg: {
    color: '#dc2626',
    fontSize: '0.85rem',
    margin: '0.25rem 0 0',
    lineHeight: 1.5,
  },
  resultBox: {
    marginTop: '1rem',
    background: '#f0fdf4',
    border: '1px solid #86efac',
    borderRadius: '0.75rem',
    padding: '0.875rem',
  },
  resultTitle: {
    fontWeight: 700,
    color: '#16a34a',
    margin: '0 0 0.75rem',
    fontSize: '0.95rem',
  },
  counts: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap' as const,
  },
  badge: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    background: 'white',
    border: '1px solid #bbf7d0',
    borderRadius: '0.5rem',
    padding: '0.4rem 0.75rem',
    minWidth: '3.5rem',
  },
  badgeNum: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#16a34a',
    lineHeight: 1,
  },
  badgeLabel: {
    fontSize: '0.7rem',
    color: '#666',
    marginTop: '0.2rem',
  },
  missionNote: {
    fontSize: '0.8rem',
    color: '#15803d',
    margin: '0.75rem 0 0',
  },
  warnBox: {
    marginTop: '0.75rem',
    background: '#fffbeb',
    border: '1px solid #fcd34d',
    borderRadius: '0.5rem',
    padding: '0.75rem',
  },
  warnTitle: {
    fontWeight: 600,
    color: '#92400e',
    margin: '0 0 0.5rem',
    fontSize: '0.85rem',
  },
  warnMsg: {
    color: '#78350f',
    fontSize: '0.8rem',
    margin: '0.2rem 0 0',
    lineHeight: 1.5,
  },
  divider: {
    height: '1px',
    background: '#eee',
    margin: '1rem 0',
  },
  modeLabel: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#444',
    margin: '0 0 0.5rem',
  },
  radioRow: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
    marginBottom: '0.25rem',
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.825rem',
    color: '#555',
  },
} as const
