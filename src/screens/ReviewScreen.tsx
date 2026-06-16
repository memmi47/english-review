import { useEffect, useState } from 'react'
import { dueForReview, reviewPhrase, reviewVocab } from '../db'
import type { PhraseRow, VocabRow, Grade } from '../db'
import { dueStudyItems, reviewStudyItem } from '../db/study'
import type { DueStudyItem } from '../db/study'
import { styles, colors } from '../shared/styles'
import { SpeakerButton } from '../shared/SpeakerButton'

type CardItem =
  | { kind: 'phrase'; row: PhraseRow }
  | { kind: 'vocab'; row: VocabRow }
  | DueStudyItem

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 짧은 단어/숙어보다 "문장 단위" 표현(교정·rewrite·긴 phrase)을 먼저 복습하도록 정렬한다.
// 실수했던 문장 자체를 계속 보는 게 아니라, 그 자리를 대체할 좋은 문장을 더 많이 연습하는 게 목적.
function targetText(item: CardItem): string {
  if (item.kind === 'phrase') return item.row.phrase
  if (item.kind === 'vocab') return item.row.word
  if (item.kind === 'correction') return item.row.corrected
  return item.row.native_version
}

function sentencePriority(item: CardItem): number {
  const wordCount = targetText(item).trim().split(/\s+/).filter(Boolean).length
  if (item.kind === 'correction' || item.kind === 'rewrite') return 100 + wordCount
  return wordCount
}

// "A / B" 처럼 슬래시로 묶인 대체 표현들을 한 줄에 뭉쳐 보여주지 않고 각각 줄바꿈으로 분리한다.
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
      const [{ phrases, vocab }, studyItems] = await Promise.all([
        dueForReview(),
        dueStudyItems(),
      ])
      const items: CardItem[] = [
        ...phrases.map(row => ({ kind: 'phrase' as const, row })),
        ...vocab.map(row => ({ kind: 'vocab' as const, row })),
        ...studyItems,
      ]
      // 무작위로 섞은 뒤, 문장 단위 표현(긴 문장/교정/rewrite)이 앞쪽에 오도록 정렬
      const sorted = shuffle(items).sort((a, b) => sentencePriority(b) - sentencePriority(a))
      setQueue(sorted)
    })()
  }, [])

  async function handleGrade(grade: Grade) {
    if (!queue) return
    const current = queue[index]
    if (current.kind === 'phrase') await reviewPhrase(current.row.id, grade)
    else if (current.kind === 'vocab') await reviewVocab(current.row.id, grade)
    else await reviewStudyItem(current.kind, current.row.id, grade)
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

  const typeBadgeLabel = {
    phrase: 'Phrase', vocab: '어휘', correction: '교정', rewrite: 'Rewrite',
  }[current.kind]

  // 앞면 = 내가 말해야 할 정답/추천 문장(좋은 표현). 오답(예전에 잘못 썼던 문장)은
  // 크게 보여주지 않고, 뒷면에 참고용으로만 작게 덧붙인다 — 나쁜 습관을 계속 보는 게 아니라
  // 좋은 문장으로 덮어쓰는 게 목적이기 때문.
  let front: string
  let meaning: string | null = null  // 한국어 뜻 (phrase/vocab)
  let backNote: string | null // 피드백/뉘앙스/문법 설명
  let example: string | null = null  // 예문 (phrase)
  let mistakeRef: string | null = null // 예전에 썼던 문장(참고용, 작게만)
  if (current.kind === 'phrase') {
    front = current.row.phrase
    meaning = current.row.meaning
    backNote = current.row.note || null
    example = current.row.example
  } else if (current.kind === 'vocab') {
    front = current.row.word
    meaning = current.row.meaning
    backNote = current.row.note || null
  } else if (current.kind === 'correction') {
    front = current.row.corrected
    backNote = current.row.rule || null
    mistakeRef = current.row.original
  } else {
    front = current.row.native_version
    backNote = current.row.nuance || null
    mistakeRef = current.row.user_expr
  }

  return (
    <div style={styles.card}>
      <div style={localStyles.headerRow}>
        <p style={styles.subtitle}>{index + 1} / {queue.length}</p>
        <span style={localStyles.typeBadge}>{typeBadgeLabel}</span>
      </div>

      <div style={localStyles.flashcard}>
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
            설명 보기
          </button>
        ) : (
          <div style={localStyles.back}>
            {meaning && <p style={localStyles.meaning}>{meaning}</p>}
            {backNote && (
              <p style={localStyles.note}>💡 {backNote}</p>
            )}
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
            {mistakeRef && (
              <div style={localStyles.frontStack}>
                {splitVariants(mistakeRef).map((part, i) => (
                  <p key={i} style={localStyles.mistakeRef}>예전엔 이렇게 썼었어요: "{part}"</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {flipped && (
        <div style={localStyles.gradeRow}>
          <button style={localStyles.againButton} onClick={() => handleGrade('again')}>
            🔁 더 연습할게요
          </button>
          <button style={localStyles.goodButton} onClick={() => handleGrade('good')}>
            😎 입에 붙었어요
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
  mistakeRef: {
    fontSize: '0.75rem',
    color: '#aaa',
    fontStyle: 'italic' as const,
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
