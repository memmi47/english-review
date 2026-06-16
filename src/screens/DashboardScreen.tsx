import { useEffect, useState } from 'react'
import { tagRecurrence, phraseAdoption, missionCompletion, dueForReview } from '../db'
import type { TagStat } from '../db'
import { styles, colors } from '../shared/styles'

interface Data {
  tags: TagStat[]
  adoption: { total: number; adopted: number; rate: number }
  mission: { total: number; completed: number; rate: number }
  due: { count: number; phrases: number; vocab: number }
}

export default function DashboardScreen({ onGoReview }: { onGoReview: () => void }) {
  const [data, setData] = useState<Data | null>(null)

  useEffect(() => {
    (async () => {
      const [tags, adoption, mission, due] = await Promise.all([
        tagRecurrence(), phraseAdoption(), missionCompletion(), dueForReview(),
      ])
      setData({
        tags,
        adoption: { total: adoption.total, adopted: adoption.adopted, rate: adoption.rate },
        mission,
        due: { count: due.count, phrases: due.phrases.length, vocab: due.vocab.length },
      })
    })()
  }, [])

  if (!data) {
    return (
      <div style={styles.card}>
        <p style={styles.subtitle}>불러오는 중...</p>
      </div>
    )
  }

  return (
    <>
      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>📅 오늘 복습</h2>
        <p style={styles.subtitle}>Phrase {data.due.phrases}개 · 어휘 {data.due.vocab}개</p>
        <div style={localStyles.bigNumber}>{data.due.count}</div>
        <button style={styles.button} onClick={onGoReview} disabled={data.due.count === 0}>
          {data.due.count === 0 ? '오늘 복습할 항목이 없어요' : '복습하러 가기 →'}
        </button>
      </div>

      <div style={{ ...styles.card, marginTop: '1rem' }}>
        <h2 style={styles.sectionTitle}>⚠️ 약점 재발 순위</h2>
        <p style={styles.subtitle}>교정/약점 패턴에서 자주 등장한 태그예요.</p>
        {data.tags.length === 0 ? (
          <p style={styles.subtitle}>아직 기록된 약점이 없어요.</p>
        ) : (
          <div style={localStyles.rankList}>
            {data.tags.slice(0, 5).map((t, i) => (
              <div key={t.tag} style={localStyles.rankRow}>
                <span style={localStyles.rankIndex}>{i + 1}</span>
                <span style={localStyles.rankTag}>{t.tag}</span>
                <span style={localStyles.rankCount}>{t.count}회</span>
                {t.lastSeen && <span style={localStyles.rankDate}>최근 {t.lastSeen}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ ...styles.card, marginTop: '1rem' }}>
        <h2 style={styles.sectionTitle}>🔁 Phrase 사용률</h2>
        <p style={styles.subtitle}>추천받은 Phrase를 이후 세션에서 실제로 썼는지 비율이에요.</p>
        <div style={localStyles.rateRow}>
          <div style={localStyles.rateBarTrack}>
            <div style={{ ...localStyles.rateBarFill, width: `${Math.round(data.adoption.rate * 100)}%` }} />
          </div>
          <span style={localStyles.ratePct}>{Math.round(data.adoption.rate * 100)}%</span>
        </div>
        <p style={localStyles.rateSub}>{data.adoption.adopted} / {data.adoption.total}개 사용됨</p>
      </div>

      <div style={{ ...styles.card, marginTop: '1rem' }}>
        <h2 style={styles.sectionTitle}>✅ 미션 이행률</h2>
        <p style={styles.subtitle}>다음 세션 추천 액션을 얼마나 이행했는지예요.</p>
        <div style={localStyles.rateRow}>
          <div style={localStyles.rateBarTrack}>
            <div style={{ ...localStyles.rateBarFill, width: `${Math.round(data.mission.rate * 100)}%` }} />
          </div>
          <span style={localStyles.ratePct}>{Math.round(data.mission.rate * 100)}%</span>
        </div>
        <p style={localStyles.rateSub}>{data.mission.completed} / {data.mission.total}개 완료</p>
      </div>
    </>
  )
}

const localStyles = {
  bigNumber: {
    fontSize: '2.5rem',
    fontWeight: 800,
    color: colors.primary,
    margin: '0.5rem 0 1rem',
  },
  rankList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  rankRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: '#f8f8ff',
    borderRadius: '0.5rem',
    padding: '0.5rem 0.75rem',
  },
  rankIndex: {
    fontWeight: 700,
    color: colors.primary,
    width: '1.25rem',
  },
  rankTag: {
    flex: 1,
    fontWeight: 600,
    color: '#333',
    fontSize: '0.9rem',
    textAlign: 'left' as const,
  },
  rankCount: {
    fontSize: '0.85rem',
    color: colors.red,
    fontWeight: 600,
  },
  rankDate: {
    fontSize: '0.7rem',
    color: '#999',
  },
  rateRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  rateBarTrack: {
    flex: 1,
    height: '0.6rem',
    borderRadius: '1rem',
    background: '#eee',
    overflow: 'hidden' as const,
  },
  rateBarFill: {
    height: '100%',
    background: colors.primary,
    borderRadius: '1rem',
  },
  ratePct: {
    fontWeight: 700,
    color: colors.primary,
    minWidth: '3rem',
    textAlign: 'right' as const,
  },
  rateSub: {
    fontSize: '0.8rem',
    color: '#999',
    margin: '0.5rem 0 0',
  },
} as const
