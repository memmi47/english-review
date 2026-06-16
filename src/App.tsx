import { useState } from 'react'
import { parseReport, ingestReport } from './db'
import type { IngestResult } from './db'

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; messages: string[] }
  | { kind: 'done'; result: IngestResult; warnings: string[] }

export default function App() {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

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
    } catch (e) {
      setStatus({ kind: 'error', messages: [String(e)] })
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
    justifyContent: 'center',
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
} as const
