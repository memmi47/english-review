// HomeScreen.tsx — 통합 "오늘의 학습" 홈 화면
import { useEffect, useState } from 'react'
import { dueForReview } from '../db'
import { dueStudyItems } from '../db/study'
import { dueDrillCount } from '../db/drills'
import { getStreakInfo, getStudyHeatmap, hasSessionToday } from '../db/streak'
import { db } from '../db/schema'
import type { PhraseRow, VocabRow } from '../db/schema'
import { StreakBar } from '../shared/StreakBar'
import { styles, colors, radius } from '../shared/styles'

type ExposureItem =
  | { kind: 'Phrase'; text: string; meaning: string; reps: number; createdAt: string }
  | { kind: 'Vocab'; text: string; meaning: string; reps: number; createdAt: string }

interface HomeData {
  streak: number
  longestStreak: number
  studiedToday: boolean
  heatmap: Record<string, boolean>
  reviewCount: number   // phrase + vocab
  practiceCount: number // correction + rewrite + 문제은행 드릴
  drillCount: number    // 문제은행 드릴만
  hasSessionToday: boolean
  stats: {
    studyDays: number
    sessions: number
    corrections: number
    phrases: number
  }
  exposure: ExposureItem[]
}

type Tab = 'import' | 'home' | 'review' | 'practice' | 'dashboard'

interface Props {
  onNavigate: (tab: Tab) => void
}

function greetingMessage(studiedToday: boolean, streak: number): string {
  const hour = new Date().getHours()
  const timeGreet = hour < 12 ? '좋은 아침이에요' : hour < 18 ? '안녕하세요' : '수고하셨어요'
  if (!studiedToday) return `${timeGreet}. 오늘 리포트를 입력해보세요.`
  if (streak >= 7) return `${timeGreet}. ${streak}일 연속으로 좋은 흐름입니다.`
  if (streak >= 3) return `${timeGreet}. ${streak}일째 꾸준히 이어가고 있습니다.`
  return `${timeGreet}. 오늘 학습이 기록되었습니다.`
}

function itemReps(row: PhraseRow | VocabRow): number {
  return typeof row.reps === 'number' ? row.reps : row.srs_box === 1 ? 0 : 1
}

function buildExposure(phrases: PhraseRow[], vocab: VocabRow[]): ExposureItem[] {
  const phraseItems: ExposureItem[] = phrases.map(p => ({
    kind: 'Phrase',
    text: p.phrase,
    meaning: p.meaning,
    reps: itemReps(p),
    createdAt: p.created_at,
  }))
  const vocabItems: ExposureItem[] = vocab.map(v => ({
    kind: 'Vocab',
    text: v.word,
    meaning: v.meaning,
    reps: itemReps(v),
    createdAt: v.created_at,
  }))

  return [...phraseItems, ...vocabItems]
    .sort((a, b) => {
      const repsDiff = a.reps - b.reps
      if (repsDiff !== 0) return repsDiff
      return b.createdAt.localeCompare(a.createdAt)
    })
    .slice(0, 5)
}

export default function HomeScreen({ onNavigate }: Props) {
  const [data, setData] = useState<HomeData | null>(null)

  useEffect(() => {
    ; (async () => {
      const [streakInfo, heatmap, { phrases, vocab }, studyItems, drillsDue, todayDone, sessions, allPhrases, allVocab, corrections] =
        await Promise.all([
          getStreakInfo(),
          getStudyHeatmap(70),
          dueForReview(),
          dueStudyItems(),
          dueDrillCount(),
          hasSessionToday(),
          db.sessions.toArray(),
          db.phrases.toArray(),
          db.vocab.toArray(),
          db.corrections.count(),
        ])
      const studyDays = new Set(sessions.map(s => s.date)).size

      setData({
        streak: streakInfo.streak,
        longestStreak: streakInfo.longestStreak,
        studiedToday: streakInfo.studiedToday,
        heatmap,
        reviewCount: phrases.length + vocab.length,
        practiceCount: studyItems.length + drillsDue,
        drillCount: drillsDue,
        hasSessionToday: todayDone,
        stats: {
          studyDays,
          sessions: sessions.length,
          corrections,
          phrases: allPhrases.length + allVocab.length,
        },
        exposure: buildExposure(allPhrases, allVocab),
      })
    })()
  }, [])

  if (!data) {
    return (
      <div style={{ ...styles.card, textAlign: 'center', padding: '2rem' }}>
        <p style={styles.subtitle}>불러오는 중...</p>
      </div>
    )
  }

  const greeting = greetingMessage(data.studiedToday, data.streak)
  const allDone = data.hasSessionToday && data.reviewCount === 0 && data.practiceCount === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} className="animate-fade-in">
      {/* 인사말 */}
      <div style={{
        background: colors.surface,
        borderRadius: radius.lg,
        padding: '1.1rem 1.25rem 0.9rem',
        boxShadow: 'var(--shadow-card)',
        border: `1px solid ${colors.border}`,
      }}>
        <p style={{ fontSize: '0.95rem', fontWeight: 600, color: colors.text, margin: 0 }}>
          {greeting}
        </p>
        {allDone && (
          <p style={{ fontSize: '0.78rem', color: colors.textMuted, marginTop: '0.25rem' }}>
            오늘 학습을 모두 완료했습니다. 다음 복습 일정에 다시 표시됩니다.
          </p>
        )}
      </div>

      {/* 스트릭 + 히트맵 */}
      <StreakBar
        streak={data.streak}
        longestStreak={data.longestStreak}
        studiedToday={data.studiedToday}
        heatmap={data.heatmap}
        stats={data.stats}
      />

      {/* 오늘의 학습 카드들 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {/* 리포트 입력 */}
        <TodoCard
          title="리포트 입력"
          subtitle={data.hasSessionToday ? '오늘 리포트 입력 완료' : '오늘 대화 리포트를 붙여넣으세요'}
          done={data.hasSessionToday}
          estimatedMin={1}
          onClick={() => onNavigate('import')}
          accent="blue"
        />

        {/* 복습 */}
        <TodoCard
          title="단어 복습"
          subtitle={
            data.reviewCount === 0
              ? '오늘 복습할 카드 없음'
              : `Phrase & 어휘 총 ${data.reviewCount}장`
          }
          done={data.reviewCount === 0}
          estimatedMin={Math.ceil(data.reviewCount * 0.4)}
          count={data.reviewCount}
          onClick={() => onNavigate('review')}
          accent="green"
        />

        {/* 연습 */}
        <TodoCard
          title="문장 연습"
          subtitle={
            data.practiceCount === 0
              ? '오늘 연습할 문장 없음'
              : data.drillCount > 0
                ? `문제은행 ${data.drillCount} · 재작성 ${data.practiceCount - data.drillCount}개`
                : `교정 & Rewrite 총 ${data.practiceCount}개`
          }
          done={data.practiceCount === 0}
          estimatedMin={Math.ceil(data.practiceCount * 0.7)}
          count={data.practiceCount}
          onClick={() => onNavigate('practice')}
          accent="purple"
        />
      </div>

      {data.exposure.length > 0 && (
        <ExposureList items={data.exposure} />
      )}
    </div>
  )
}

// ── TodoCard 서브 컴포넌트 ──

type Accent = 'blue' | 'green' | 'purple'

const accentMap: Record<Accent, { bg: string; border: string; color: string; countBg: string }> = {
  blue:   { bg: 'var(--primary-light)', border: 'var(--primary)', color: 'var(--primary)', countBg: 'var(--primary)' },
  green:  { bg: 'var(--green-bg)', border: 'var(--green-border)', color: 'var(--green)', countBg: 'var(--green)' },
  purple: { bg: 'var(--purple-bg)', border: 'var(--purple-border)', color: 'var(--purple)', countBg: 'var(--purple)' },
}

function TodoCard({
  title, subtitle, done, estimatedMin, count, onClick, accent,
}: {
  title: string
  subtitle: string
  done: boolean
  estimatedMin: number
  count?: number
  onClick: () => void
  accent: Accent
}) {
  const a = accentMap[accent]
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.875rem 1rem 0.875rem 0.85rem',
        background: done ? colors.surfaceAlt : colors.surface,
        border: `1px solid ${done ? colors.border : a.border}`,
        borderRadius: radius.lg,
        boxShadow: done ? 'none' : 'var(--shadow-card)',
        cursor: 'pointer',
        textAlign: 'left' as const,
        transition: 'transform 0.1s, box-shadow 0.15s',
        fontFamily: 'inherit',
        opacity: done ? 0.7 : 1,
      }}
    >
      <div style={{
        width: '3px',
        alignSelf: 'stretch',
        minHeight: '2.4rem',
        borderRadius: radius.pill,
        background: done ? colors.borderStrong : a.color,
        opacity: done ? 0.35 : 1,
        flexShrink: 0,
      }} />

      {/* 텍스트 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: '0.9rem',
          fontWeight: 700,
          color: done ? colors.textMuted : colors.text,
          margin: 0,
          textDecoration: done ? 'line-through' : 'none',
        }}>
          {title}
        </p>
        <p style={{ fontSize: '0.75rem', color: colors.textSubtle, margin: '0.1rem 0 0', lineHeight: 1.4 }}>
          {subtitle}
        </p>
      </div>

      {/* 오른쪽: 카운트 뱃지 or 시간 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: 0 }}>
        {!done && count != null && count > 0 && (
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            color: 'white',
            background: a.countBg,
            borderRadius: radius.pill,
            padding: '0.15rem 0.5rem',
            minWidth: '1.5rem',
            textAlign: 'center',
          }}>
            {count}
          </span>
        )}
        {!done && estimatedMin > 0 && (
          <span style={{ fontSize: '0.65rem', color: colors.textSubtle }}>
            ~{estimatedMin}분
          </span>
        )}
        {!done && <span style={{ fontSize: '0.8rem', color: colors.textSubtle }}>›</span>}
      </div>
    </button>
  )
}

function ExposureList({ items }: { items: ExposureItem[] }) {
  return (
    <div style={styles.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', marginBottom: '0.75rem' }}>
        <div>
          <h2 style={styles.sectionTitle}>오늘 노출할 표현</h2>
          <p style={{ ...styles.subtitle, margin: '0.15rem 0 0' }}>미출제 또는 최근 추가된 표현을 먼저 보여줍니다.</p>
        </div>
        <span style={{
          fontSize: '0.68rem',
          color: colors.amber,
          background: colors.amberBg,
          border: `1px solid ${colors.amberBorder}`,
          borderRadius: radius.pill,
          padding: '0.18rem 0.55rem',
          fontWeight: 700,
          whiteSpace: 'nowrap',
        }}>
          Daily 5
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        {items.map(item => (
          <div key={`${item.kind}:${item.text}`} style={{
            display: 'grid',
            gridTemplateColumns: '4rem 1fr',
            gap: '0.65rem',
            padding: '0.65rem 0',
            borderTop: `1px solid ${colors.divider}`,
          }}>
            <span style={{
              fontSize: '0.68rem',
              color: item.kind === 'Phrase' ? colors.primary : colors.amber,
              fontWeight: 800,
              letterSpacing: '0',
            }}>
              {item.kind}
            </span>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: '0.86rem', fontWeight: 700, color: colors.text, margin: 0, lineHeight: 1.35 }}>
                {item.text}
              </p>
              <p style={{ fontSize: '0.75rem', color: colors.textMuted, margin: '0.15rem 0 0', lineHeight: 1.45 }}>
                {item.meaning}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
