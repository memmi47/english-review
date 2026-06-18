import { useEffect, useState } from 'react'
import { dueForReview, reviewPhrase, reviewVocab } from '../db'
import type { PhraseRow, VocabRow, Grade } from '../db'
import { styles, colors } from '../shared/styles'
import { SpeakerButton } from '../shared/SpeakerButton'

// 복습 탭은 phrase/vocab(의미 암기)만 담당한다.
// correction/rewrite 문장 훈련은 ✍️ 연습 탭이 전담한다.
type CardItem =
  | { kind: 'phrase'; row: PhraseRow }
  | { kind: 'vocab'; row: VocabRow }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// "A / B" 처럼 슬래시로 묶인 대체 표현들을 각각 줄바꿈으로 분리한다.
function splitVariants(text: string): string[] {
  return text.split('/').map(s => s.trim()).filter(s => s.length > 0)
}

export default function ReviewScreen() {
  const [queue, setQueue] = useState<CardItem[] | null>(null)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [gradedCount, setGradedCount] = useState(0)

  useEffect(() => {
    (async () => {
      const { phrases, vocab } = await dueForReview()
      const items: CardItem[] = [
        ...phrases.map(row => ({ kind: 'phrase' as const, row })),
        ...vocab.map(row => ({ kind: 'vocab' as const, row })),
      ]
      setQueue(shuffle(items))
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
      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>🎉 오늘 복습할 항목이 없어요</h2>
        <p style={styles.subtitle}>모든 카드가 완료됐어요. 내일 다시 와주세요!</p>
      </div>
    )
  }

  if (index >= queue.length) {
    return (
      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>✅ 오늘 복습 끝!</h2>
        <p style={styles.subtitle}>{gradedCount}개 카드를 복습했어요. 잘했어요!</p>
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
        <p style={styles.subtitle}>{index + 1} / {queue.length}</p>
        <span style={localStyles.typeBadge}>{current.kind === 'phrase' ? 'Phrase' : '어휘'}</span>
      </div>

      <div style={localStyles.flashcard}>
        {/* 앞면: 영어 표현 + 발음 듣기 */}
        <div style={localStyles.frontStack}>
          {splitVariants(front).map((part, i) => (
            <div key={i} style={localStyles.frontRow}>
              <p style={localStyles.phraseText}>{part}</p>
              <SpeakerButton text={part} />
            </div>
          ))}
        </div>

        {!flipped ? (
          <button style={styles.secondaryButton} onClick={() => setFlipped(true)}>
            뜻 확인
          </button>
        ) : (
          <div style={localStyles.back}>
            <p style={localStyles.meaning}>{meaning}</p>
            {note && <p style={localStyles.note}>💡 {note}</p>}
            {example && (
              <div style={localStyles.frontStack}>
                {splitVariants(example).map((part, i) => (
                  <div key={i} style={localStyles.frontRow}>
                    <p style={localStyles.example}>"{part}"</p>
                    <SpeakerButton text={part} size="small" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {flipped && (
        <div style={localStyles.gradeRow}>
          <button style={localStyles.againButton} onClick={() => handleGrade('again')}>
            🔁 다시
          </button>
          <button style={localStyles.goodButton} onClick={() => handleGrade('good')}>
            ✅ 알아요
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
  },
  typeBadge: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: colors.primary,
    background: '#eef0ff',
    borderRadius: '999px',
    padding: '0.2rem 0.6rem',
  },
  flashcard: {
    marginTop: '0.5rem',
    background: '#f8f8ff',
    borderRadius: '1rem',
    padding: '2rem 1rem',
    textAlign: 'center' as const,
    minHeight: '180px',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    gap: '1rem',
  },
  frontRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
  },
  frontStack: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  phraseText: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: colors.primary,
    margin: 0,
  },
  back: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
    alignItems: 'center',
  },
  meaning: {
    fontSize: '1.1rem',
    fontWeight: 600,
    color: '#333',
    margin: 0,
  },
  example: {
    fontSize: '0.9rem',
    color: '#666',
    fontStyle: 'italic' as const,
    margin: 0,
  },
  note: {
    fontSize: '0.8rem',
    color: '#7a6a00',
    background: '#fff8e1',
    borderRadius: '0.5rem',
    padding: '0.4rem 0.6rem',
    margin: 0,
  },
  gradeRow: {
    display: 'flex',
    gap: '0.75rem',
    marginTop: '1rem',
  },
  againButton: {
    flex: 1,
    padding: '0.875rem',
    background: '#fff0f0',
    color: colors.red,
    border: `1.5px solid ${colors.redBorder}`,
    borderRadius: '0.75rem',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  goodButton: {
    flex: 1,
    padding: '0.875rem',
    background: colors.greenBg,
    color: colors.green,
    border: `1.5px solid ${colors.greenBorder}`,
    borderRadius: '0.75rem',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
} as const
