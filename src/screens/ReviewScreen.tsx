import { useEffect, useState } from 'react'
import { dueForReview, reviewPhrase, reviewVocab } from '../db'
import type { PhraseRow, VocabRow, Grade } from '../db'
import { getStreakInfo } from '../db/streak'
import { styles, colors, radius, type } from '../shared/styles'
import { SpeakerButton } from '../shared/SpeakerButton'

// 복습 탭은 phrase/vocab(의미 암기)만 담당한다.
// correction/rewrite 문장 훈련은 연습 탭이 전담한다.
type CardItem =
  | { kind: 'phrase'; row: PhraseRow }
  | { kind: 'vocab'; row: VocabRow }

interface Props {
  onGoPractice?: () => void
}

// "A / B" 처럼 슬래시로 묶인 대체 표현들을 각각 줄바꿈으로 분리한다.
function splitVariants(text: string): string[] {
  return text.split('/').map(s => s.trim()).filter(s => s.length > 0)
}

function reviewCount(row: PhraseRow | VocabRow): number {
  if ('reps' in row && typeof row.reps === 'number') return row.reps
  return row.srs_box === 1 ? 0 : 1
}

function orderCards(items: CardItem[]): CardItem[] {
  return [...items].sort((a, b) => {
    const repsDiff = reviewCount(a.row) - reviewCount(b.row)
    if (repsDiff !== 0) return repsDiff
    return a.row.created_at.localeCompare(b.row.created_at)
  })
}

export default function ReviewScreen({ onGoPractice }: Props) {
  const [queue, setQueue] = useState<CardItem[] | null>(null)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [gradedCount, setGradedCount] = useState(0)
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    (async () => {
      const [{ phrases, vocab }, streakInfo] = await Promise.all([dueForReview(), getStreakInfo()])
      const items: CardItem[] = [
        ...phrases.map(row => ({ kind: 'phrase' as const, row })),
        ...vocab.map(row => ({ kind: 'vocab' as const, row })),
      ]
      setQueue(orderCards(items))
      setStreak(streakInfo.streak)
    })()
  }, [])

  async function handleGrade(grade: Grade) {
    if (!queue) return
    const current = queue[index]
    if (current.kind === 'phrase') await reviewPhrase(current.row.id, grade)
    else await reviewVocab(current.row.id, grade)
    setGradedCount(c => c + 1)
    setFlipped(false)
    setIndex(i => i + 1)
  }

  if (!queue) {
    return (
      <div style={styles.card}>
        <p style={styles.subtitle}>불러오는 중...</p>
      </div>
    )
  }

  if (queue.length === 0) {
    return (
      <div style={styles.card} className="animate-pop-in">
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎉</div>
          <h2 style={{ ...styles.sectionTitle, textAlign: 'center', marginBottom: '0.4rem' }}>오늘 복습 완료!</h2>
          <p style={{ ...styles.subtitle, textAlign: 'center', margin: 0 }}>모든 카드가 완료됐어요. 내일 다시 와주세요!</p>
        </div>
      </div>
    )
  }

  if (index >= queue.length) {
    return (
      <div style={styles.card} className="animate-pop-in">
        <div style={localStyles.doneWrap}>
          <div className="fx-ring" style={localStyles.doneRing}>✓</div>
          <h2 style={localStyles.doneTitle}>오늘 단어 복습 완료</h2>
          <p style={localStyles.doneSubtitle}>
            {gradedCount}장을 모두 복습했어요.<br />내일 다시 만나요.
          </p>
          <div style={localStyles.doneStatRow}>
            <div style={localStyles.doneStatCard}>
              <div style={localStyles.doneStatNum}>{gradedCount}</div>
              <div style={localStyles.doneStatLabel}>오늘 복습</div>
            </div>
            <div style={localStyles.doneStatCard}>
              <div style={localStyles.doneStatNum}>{streak}일</div>
              <div style={localStyles.doneStatLabel}>연속 학습</div>
            </div>
          </div>
          {onGoPractice && (
            <button style={{ ...styles.button, width: '100%', margin: 0 }} onClick={onGoPractice}>
              문장 연습 이어하기 →
            </button>
          )}
        </div>
      </div>
    )
  }

  const current = queue[index]

  const front = current.kind === 'phrase' ? current.row.phrase : current.row.word
  const meaning = current.row.meaning
  const note = current.row.note || null
  const example = current.kind === 'phrase' ? current.row.example : null

  return (
    <div style={styles.card}>
      <div style={localStyles.headerRow}>
        <p style={localStyles.progress}>{index + 1} / {queue.length}</p>
        <span style={localStyles.typeBadge}>{current.kind === 'phrase' ? 'Phrase' : '어휘'}</span>
      </div>

      {!flipped ? (
        <div style={localStyles.frontCard}>
          <div style={localStyles.frontStack}>
            {splitVariants(front).map((part, i) => (
              <p key={i} style={localStyles.phraseText}>{part}</p>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem' }}>
            {splitVariants(front).map((part, i) => (
              <SpeakerButton key={i} text={part} />
            ))}
          </div>
        </div>
      ) : (
        <div className="animate-fade-in" style={localStyles.backCard}>
          <p style={localStyles.backLabel}>{front}</p>
          <p style={localStyles.meaning}>{meaning}</p>
          {example && (
            <div style={localStyles.exampleBox}>
              {splitVariants(example).map((part, i) => (
                <div key={i} style={localStyles.exampleRow}>
                  <SpeakerButton text={part} size="small" />
                  <p style={localStyles.example}>"{part}"</p>
                </div>
              ))}
            </div>
          )}
          {note && <p style={localStyles.note}>💡 {note}</p>}
        </div>
      )}

      {!flipped ? (
        <button style={{ ...styles.secondaryButton, marginTop: '1.25rem' }} onClick={() => setFlipped(true)}>
          뜻 확인
        </button>
      ) : (
        <div style={localStyles.gradeRow}>
          <button style={localStyles.againButton} onClick={() => handleGrade('again')}>
            다시
          </button>
          <button style={localStyles.goodButton} onClick={() => handleGrade('good')}>
            알아요
          </button>
        </div>
      )}
    </div>
  )
}

const localStyles = {
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  progress: {
    fontSize: type.xs,
    color: colors.textSubtle,
    fontWeight: 600,
    margin: 0,
  },
  typeBadge: {
    fontSize: type.xs,
    fontWeight: 600,
    color: colors.textSubtle,
    background: colors.surfaceAlt,
    borderRadius: '999px',
    padding: '0.2rem 0.6rem',
  },
  frontCard: {
    padding: '3rem 1.5rem',
    borderRadius: radius.xl,
    background: colors.surface,
    boxShadow: 'var(--shadow-card)',
    textAlign: 'center' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.875rem',
  },
  frontStack: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.4rem',
  },
  phraseText: {
    fontSize: type.xl,
    fontWeight: 800,
    color: colors.primary,
    lineHeight: 1.35,
    margin: 0,
  },
  backCard: {
    padding: '1.75rem 1.375rem',
    borderRadius: radius.xl,
    background: colors.surface,
    boxShadow: 'var(--shadow-card)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0',
  },
  backLabel: {
    fontSize: type.md,
    fontWeight: 700,
    color: colors.primary,
    lineHeight: 1.4,
    margin: '0 0 1rem',
  },
  meaning: {
    fontSize: type.lg,
    fontWeight: 700,
    color: colors.text,
    lineHeight: 1.5,
    margin: '0 0 1.125rem',
  },
  exampleBox: {
    padding: '0.875rem 1rem',
    borderRadius: radius.md,
    background: colors.surfaceSunken,
    marginBottom: '0.875rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  exampleRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.5rem',
  },
  example: {
    fontSize: type.base,
    color: colors.textMuted,
    fontStyle: 'italic' as const,
    lineHeight: 1.6,
    margin: 0,
  },
  note: {
    fontSize: type.sm,
    color: colors.textMuted,
    background: colors.amberBg,
    border: `1px solid ${colors.amberBorder}`,
    borderRadius: radius.md,
    padding: '0.75rem 0.875rem',
    lineHeight: 1.6,
    margin: 0,
  },
  gradeRow: {
    display: 'flex',
    gap: '0.625rem',
    marginTop: '1.25rem',
  },
  againButton: {
    flex: 1,
    minHeight: '3.5rem',
    background: colors.amberBg,
    color: colors.amber,
    border: `1.5px solid ${colors.amberBorder}`,
    borderRadius: radius.lg,
    fontSize: type.base,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  goodButton: {
    flex: 1,
    minHeight: '3.5rem',
    background: colors.greenBg,
    color: colors.green,
    border: `1.5px solid ${colors.greenBorder}`,
    borderRadius: radius.lg,
    fontSize: type.base,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  // 완료 화면
  doneWrap: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    textAlign: 'center' as const,
    padding: '0.5rem 0 0',
  },
  doneRing: {
    width: '5.5rem',
    height: '5.5rem',
    borderRadius: '50%',
    background: colors.greenBg,
    border: `1px solid ${colors.greenBorder}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2.375rem',
    color: colors.green,
    marginBottom: '1.5rem',
  },
  doneTitle: {
    fontSize: type.xl,
    fontWeight: 800,
    color: colors.text,
    margin: '0 0 0.5rem',
  },
  doneSubtitle: {
    fontSize: type.base,
    color: colors.textMuted,
    lineHeight: 1.5,
    margin: '0 0 1.75rem',
  },
  doneStatRow: {
    display: 'flex',
    gap: '0.625rem',
    width: '100%',
    marginBottom: '1.75rem',
  },
  doneStatCard: {
    flex: 1,
    padding: '1rem',
    borderRadius: radius.lg,
    background: colors.surfaceAlt,
    textAlign: 'center' as const,
  },
  doneStatNum: {
    fontSize: type.xl,
    fontWeight: 800,
    color: colors.primary,
  },
  doneStatLabel: {
    fontSize: type.xs,
    color: colors.textMuted,
    marginTop: '2px',
  },
} as const
