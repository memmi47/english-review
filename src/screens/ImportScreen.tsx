import { useEffect, useRef, useState } from 'react'
import { parseReport, ingestReport, downloadBackup, importAll, db } from '../db'
import type { IngestResult } from '../db'
import type { ParsedReport } from '../db/parser'
import { importDrillBank, totalDrillCount } from '../db/drills'
import {
  TTS_VOICES, getTtsApiKey, setTtsApiKey, getTtsVoice, setTtsVoice,
  neuralTtsEnabled, testNeuralTts, ttsCacheStats, clearTtsCache,
} from '../shared/tts'
import { styles, colors, radius } from '../shared/styles'
import { CountBadge } from '../shared/CountBadge'

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; messages: string[] }
  | { kind: 'done'; result: IngestResult; warnings: string[]; parsed: ParsedReport }

interface Props {
  onGoReview?: () => void
}

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

export default function ImportScreen({ onGoReview }: Props) {
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

  // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 시 1회 DB 카운트 조회
  useEffect(() => { void refreshCounts() }, [])

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
      setStatus({ kind: 'done', result, warnings: parsed.warnings, parsed: parsed.data })
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
    <>
      <div style={styles.card}>
        <h1 style={styles.title}>리포트 가져오기 (JSON)</h1>
        <p style={styles.subtitle}>코치가 작성해준 JSON 리포트 블록(```json ... ```)을 그대로 붙여넣으세요.</p>

        <textarea
          style={localStyles.textarea}
          placeholder="```json&#10;{&#10;  ...&#10;}&#10;```"
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
            <p style={styles.errorTitle}>저장 실패</p>
            {status.messages.map((m, i) => (
              <p key={i} style={styles.errorMsg}>{m}</p>
            ))}
          </div>
        )}

        {status.kind === 'done' && (
          <div className="animate-slide-up">
            {/* 세션 하이라이트 카드 */}
            <SessionHighlight
              result={status.result}
              parsed={status.parsed}
              warnings={status.warnings}
              onGoReview={onGoReview}
            />
          </div>
        )}
      </div>

      <div style={{ ...styles.card, marginTop: '1rem' }}>
        <h2 style={styles.sectionTitle}>저장된 데이터 현황</h2>
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
        <h2 style={styles.sectionTitle}>백업</h2>
        <p style={styles.subtitle}>기기 변경/삭제에 대비해 백업 파일을 보관하세요. 연습 완료 이력도 함께 저장됩니다.</p>

        <button
          style={{ ...styles.button, opacity: backupStatus.kind === 'exporting' ? 0.6 : 1 }}
          onClick={handleExport}
          disabled={backupStatus.kind === 'exporting'}
        >
          {backupStatus.kind === 'exporting' ? '내보내는 중...' : '백업 내보내기'}
        </button>

        <div style={styles.divider} />

        <p style={localStyles.modeLabel}>가져오기 방식</p>
        <div style={localStyles.radioRow}>
          <label style={localStyles.radioLabel}>
            <input
              type="radio"
              checked={importMode === 'merge'}
              onChange={() => setImportMode('merge')}
            />
            병합(merge) — 기존 유지, 신규만 추가
          </label>
          <label style={localStyles.radioLabel}>
            <input
              type="radio"
              checked={importMode === 'replace'}
              onChange={() => setImportMode('replace')}
            />
            전체 교체(replace) — 학습 데이터 덮어쓰기, 백업에 없으면 연습 이력 유지
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
          style={{ ...styles.secondaryButton, opacity: backupStatus.kind === 'importing' ? 0.6 : 1 }}
          onClick={() => fileInputRef.current?.click()}
          disabled={backupStatus.kind === 'importing'}
        >
          {backupStatus.kind === 'importing' ? '가져오는 중...' : '백업 가져오기'}
        </button>

        {backupStatus.kind === 'error' && (
          <div style={styles.errorBox}>
            <p style={styles.errorTitle}>실패</p>
            <p style={styles.errorMsg}>{backupStatus.message}</p>
          </div>
        )}

        {backupStatus.kind === 'imported' && (
          <div style={styles.resultBox}>
            <p style={styles.resultTitle}>가져오기 완료</p>
            <div style={styles.counts}>
              {Object.entries(backupStatus.counts).map(([table, n]) => (
                <CountBadge key={table} label={table} value={n} />
              ))}
            </div>
          </div>
        )}
      </div>

      <DrillBankCard />

      <TtsSettingsCard />
    </>
  )
}

// ── 문제은행(드릴) 가져오기 카드 ──

type DrillImportStatus =
  | { kind: 'idle' }
  | { kind: 'importing' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; added: number; updated: number }

function DrillBankCard() {
  const [status, setStatus] = useState<DrillImportStatus>({ kind: 'idle' })
  const [total, setTotal] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { void totalDrillCount().then(setTotal) }, [])

  async function handleFile(file: File) {
    setStatus({ kind: 'importing' })
    try {
      const text = await file.text()
      const { added, updated } = await importDrillBank(text)
      setStatus({ kind: 'done', added, updated })
      setTotal(await totalDrillCount())
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div style={{ ...styles.card, marginTop: '1rem' }}>
      <h2 style={styles.sectionTitle}>문제은행 가져오기</h2>
      <p style={styles.subtitle}>
        Claude 정제 세션에서 만들어진 문제은행 파일(.json)을 가져오면 연습 탭에
        3지선다·패턴 드릴·한→영 표현하기 문제가 추가됩니다.
        {total != null && total > 0 && <> 현재 저장된 문제: <strong>{total}개</strong></>}
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
      <button
        style={{ ...styles.button, opacity: status.kind === 'importing' ? 0.6 : 1 }}
        onClick={() => fileRef.current?.click()}
        disabled={status.kind === 'importing'}
      >
        {status.kind === 'importing' ? '가져오는 중...' : '문제은행 파일 선택'}
      </button>

      {status.kind === 'error' && (
        <div style={styles.errorBox}>
          <p style={styles.errorTitle}>가져오기 실패</p>
          <p style={styles.errorMsg}>{status.message}</p>
        </div>
      )}
      {status.kind === 'done' && (
        <div style={styles.resultBox}>
          <p style={styles.resultTitle}>가져오기 완료</p>
          <div style={styles.counts}>
            <CountBadge label="새 문제" value={status.added} />
            <CountBadge label="갱신" value={status.updated} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── 발음 음성 설정 카드 (OpenRouter TTS) ──

function TtsSettingsCard() {
  const [apiKey, setApiKey] = useState(() => getTtsApiKey())
  const [voice, setVoice] = useState(() => getTtsVoice())
  const [testState, setTestState] = useState<{ kind: 'idle' } | { kind: 'testing' } | { kind: 'result'; ok: boolean; message: string }>({ kind: 'idle' })
  const [cache, setCache] = useState<{ count: number; mb: number } | null>(null)

  useEffect(() => { void ttsCacheStats().then(setCache) }, [])

  function handleKeyChange(v: string) {
    setApiKey(v)
    setTtsApiKey(v)
    setTestState({ kind: 'idle' })
  }

  function handleVoiceChange(v: string) {
    setVoice(v)
    setTtsVoice(v)
    setTestState({ kind: 'idle' })
  }

  async function handleTest() {
    setTestState({ kind: 'testing' })
    const result = await testNeuralTts('Hello! This is your new pronunciation voice. How does it sound?')
    setTestState({ kind: 'result', ok: result.ok, message: result.message })
    setCache(await ttsCacheStats())
  }

  async function handleClearCache() {
    await clearTtsCache()
    setCache(await ttsCacheStats())
  }

  return (
    <div style={{ ...styles.card, marginTop: '1rem' }}>
      <h2 style={styles.sectionTitle}>발음 음성 설정</h2>
      <p style={styles.subtitle}>
        OpenRouter API 키를 입력하면 발음 버튼이 사람 수준의 자연스러운 AI 음성으로 바뀝니다.
        한 번 들은 문장은 기기에 저장되어 다시 비용이 들지 않아요 (문장당 약 1~2원).
        키가 없으면 기기 기본 음성을 사용합니다.
      </p>

      <p style={localStyles.modeLabel}>OpenRouter API 키 <span style={{ fontWeight: 400 }}>(openrouter.ai/keys 에서 발급)</span></p>
      <input
        type="password"
        style={localStyles.keyInput}
        placeholder="sk-or-v1-..."
        value={apiKey}
        onChange={e => handleKeyChange(e.target.value)}
        autoComplete="off"
      />

      <p style={{ ...localStyles.modeLabel, marginTop: '0.75rem' }}>목소리</p>
      <select
        style={localStyles.voiceSelect}
        value={voice}
        onChange={e => handleVoiceChange(e.target.value)}
      >
        {TTS_VOICES.map(v => (
          <option key={v.id} value={v.id}>{v.label}</option>
        ))}
      </select>

      <button
        style={{ ...styles.button, opacity: !neuralTtsEnabled() || testState.kind === 'testing' ? 0.5 : 1 }}
        onClick={handleTest}
        disabled={!neuralTtsEnabled() || testState.kind === 'testing'}
      >
        {testState.kind === 'testing' ? '재생 중...' : '이 목소리로 테스트'}
      </button>

      {testState.kind === 'result' && (
        <div style={testState.ok ? styles.resultBox : styles.errorBox}>
          <p style={testState.ok ? styles.resultTitle : styles.errorTitle}>
            {testState.ok ? '연결 성공' : '연결 실패'}
          </p>
          <p style={testState.ok ? { ...styles.errorMsg, color: colors.green } : styles.errorMsg}>
            {testState.message}
          </p>
        </div>
      )}

      {cache && cache.count > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem' }}>
          <span style={{ fontSize: '0.75rem', color: colors.textSubtle }}>
            저장된 발음 {cache.count}개 · {cache.mb}MB
          </span>
          <button
            style={{ background: 'none', border: 'none', color: colors.textMuted, fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}
            onClick={handleClearCache}
          >
            캐시 비우기
          </button>
        </div>
      )}
    </div>
  )
}

const localStyles = {
  textarea: {
    width: '100%',
    minHeight: '220px',
    padding: '0.75rem',
    borderRadius: '0.75rem',
    border: '1.5px solid var(--border)',
    fontSize: '0.875rem',
    fontFamily: 'monospace',
    resize: 'vertical' as const,
    boxSizing: 'border-box' as const,
    outline: 'none',
    color: 'var(--text)',
    background: 'var(--surface)',
    colorScheme: 'light' as const,
    lineHeight: 1.5,
  },
  missionNote: {
    fontSize: '0.8rem',
    color: 'var(--green)',
    margin: '0.75rem 0 0',
  },
  modeLabel: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
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
  keyInput: {
    width: '100%',
    padding: '0.65rem 0.75rem',
    borderRadius: '0.625rem',
    border: '1.5px solid var(--border)',
    fontSize: '0.875rem',
    fontFamily: 'monospace',
    boxSizing: 'border-box' as const,
    outline: 'none',
    color: 'var(--text)',
    background: 'var(--surface)',
  },
  voiceSelect: {
    width: '100%',
    padding: '0.65rem 0.75rem',
    borderRadius: '0.625rem',
    border: '1.5px solid var(--border)',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
    outline: 'none',
    color: 'var(--text)',
    background: 'var(--surface)',
  },
} as const

// ── Session Highlight Card ──

function SessionHighlight({
  result, parsed, warnings, onGoReview,
}: {
  result: IngestResult
  parsed: ParsedReport
  warnings: string[]
  onGoReview?: () => void
}) {
  const topic = parsed.meta.topic ?? ''
  const date = parsed.meta.date ?? ''
  const firstCorrection = parsed.corrections[0]
  const firstPhrase = parsed.phrases[0]
  const topWeakness = parsed.patterns.find(p => p.type === 'weakness')

  return (
    <div style={{
      marginTop: '1rem',
      background: colors.surface,
      border: `1px solid ${colors.greenBorder}`,
      borderRadius: radius.lg,
      padding: '1rem 1.25rem',
      boxShadow: 'var(--shadow-card)',
    }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
        <div>
          <p style={{ fontSize: '0.9rem', fontWeight: 700, color: colors.text, margin: 0 }}>리포트 저장 완료</p>
          {(date || topic) && (
            <p style={{ fontSize: '0.72rem', color: colors.textSubtle, margin: '1px 0 0' }}>
              {date}{topic ? ` · ${topic}` : ''}
            </p>
          )}
        </div>
      </div>

      {/* 새로 추가된 항목 요약 */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.875rem' }}>
        {result.added.corrections > 0 && <Chip label={`교정 ${result.added.corrections}`} color="red" />}
        {result.added.phrases > 0 && <Chip label={`Phrase +${result.added.phrases}`} color="blue" />}
        {result.added.vocab > 0 && <Chip label={`어휘 +${result.added.vocab}`} color="green" />}
        {result.added.rewrites > 0 && <Chip label={`Rewrite ${result.added.rewrites}`} color="purple" />}
        {result.missionsClosed > 0 && <Chip label={`미션 ${result.missionsClosed}개 완료`} color="green" />}
      </div>

      {/* 하이라이트: 첫 번째 교정 */}
      {firstCorrection && (
        <div style={{
          background: colors.surfaceAlt,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.md,
          padding: '0.7rem 0.875rem',
          marginBottom: '0.5rem',
        }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 700, color: colors.textSubtle, margin: '0 0 0.35rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>이번 세션 핵심 교정</p>
          <p style={{ fontSize: '0.8rem', color: colors.red, margin: '0 0 2px', textDecoration: 'line-through' }}>"{firstCorrection.original}"</p>
          <p style={{ fontSize: '0.85rem', fontWeight: 600, color: colors.green, margin: 0 }}>→ "{firstCorrection.corrected}"</p>
        </div>
      )}

      {/* 하이라이트: 첫 번째 추천 Phrase */}
      {firstPhrase && (
        <div style={{
          background: colors.primaryLight,
          border: `1px solid var(--primary)`,
          borderRadius: radius.md,
          padding: '0.7rem 0.875rem',
          marginBottom: '0.5rem',
        }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 700, color: colors.textSubtle, margin: '0 0 0.35rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>새 추천 Phrase</p>
          <p style={{ fontSize: '0.9rem', fontWeight: 700, color: colors.primary, margin: '0 0 2px' }}>{firstPhrase.phrase}</p>
          <p style={{ fontSize: '0.78rem', color: colors.textMuted, margin: 0 }}>{firstPhrase.meaning}</p>
        </div>
      )}

      {/* 약점 태그 */}
      {topWeakness && (
        <div style={{ marginBottom: '0.5rem' }}>
          <p style={{ fontSize: '0.72rem', color: colors.textSubtle, margin: '0 0 0.25rem' }}>주요 약점: <strong style={{ color: colors.amber }}>[{topWeakness.canonical_tag ?? 'N/A'}]</strong></p>
          <p style={{ fontSize: '0.78rem', color: colors.textMuted, margin: 0 }}>{topWeakness.description}</p>
        </div>
      )}

      {/* 경고 */}
      {warnings.length > 0 && (
        <div style={{ ...styles.warnBox, marginTop: '0.5rem' }}>
          <p style={styles.warnTitle}>경고 ({warnings.length}건)</p>
          {warnings.slice(0, 2).map((w, i) => <p key={i} style={styles.warnMsg}>{w}</p>)}
        </div>
      )}

      {/* 복습 시작 CTA */}
      {onGoReview && (
        <button
          onClick={onGoReview}
          style={{
            ...styles.button,
            background: 'var(--primary)',
            marginTop: '0.875rem',
          }}
        >
          복습 시작하기 →
        </button>
      )}
    </div>
  )
}

function Chip({ label, color }: { label: string; color: 'red' | 'blue' | 'green' | 'purple' }) {
  const map = {
    red:    { bg: colors.redBg, border: colors.redBorder, text: colors.red },
    blue:   { bg: colors.primaryLight, border: 'var(--primary)', text: colors.primary },
    green:  { bg: colors.greenBg, border: colors.greenBorder, text: colors.green },
    purple: { bg: colors.purpleBg, border: colors.purpleBorder, text: colors.purple },
  }
  const c = map[color]
  return (
    <span style={{
      fontSize: '0.7rem', fontWeight: 600,
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      borderRadius: radius.pill, padding: '0.2rem 0.55rem',
    }}>
      {label}
    </span>
  )
}
