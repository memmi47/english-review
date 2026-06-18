// HomeScreen.tsx — 통합 "오늘의 학습" 홈 화면
import { useEffect, useState } from 'react'
import { dueForReview } from '../db'
import { dueStudyItems } from '../db/study'
import { getStreakInfo, getStudyHeatmap, hasSessionToday } from '../db/streak'
import { db } from '../db/schema'
import { StreakBar } from '../shared/StreakBar'
import { styles, colors, radius } from '../shared/styles'

interface HomeData {
  streak: number
  longestStreak: number
  studiedToday: boolean
  heatmap: Record<string, boolean>
  reviewCount: number   // phrase + vocab
  practiceCount: number // correction + rewrite
  pendingMissions: { id: string; suggestion: string }[]
  hasSessionToday: boolean
}

type Tab = 'import' | 'home' | 'review' | 'practice' | 'dashboard'

interface Props {
  onNavigate: (tab: Tab) => void
}

function greetingMessage(studiedToday: boolean, streak: number): string {
  const hour = new Date().getHours()
  const timeGreet = hour < 12 ? '좋은 아침이에요' : hour < 18 ? '안녕하세요' : '수고하셨어요'
  if (!studiedToday) return `${timeGreet}! 오늘 리포트를 입력해보세요 🌱`
  if (streak >= 7) return `${timeGreet}! ${streak}일 연속 🔥 대단해요!`
  if (streak >= 3) return `${timeGreet}! ${streak}일째 꾸준히 하고 있어요 👍`
  return `${timeGreet}! 오늘도 학습 완료! 💪`
}

export default function HomeScreen({ onNavigate }: Props) {
  const [data, setData] = useState<HomeData | null>(null)

  useEffect(() => {
    ; (async () => {
      const [streakInfo, heatmap, { phrases, vocab }, studyItems, todayDone, actions] =
        await Promise.all([
          getStreakInfo(),
          getStudyHeatmap(70),
          dueForReview(),
          dueStudyItems(),
          hasSessionToday(),
          db.actions.filter(a => !a.completed).toArray(),
        ])

      setData({
        streak: streakInfo.streak,
        longestStreak: streakInfo.longestStreak,
        studiedToday: streakInfo.studiedToday,
        heatmap,
        reviewCount: phrases.length + vocab.length,
        practiceCount: studyItems.length,
        pendingMissions: actions.slice(0, 3).map(a => ({ id: a.id, suggestion: a.suggestion })),
        hasSessionToday: todayDone,
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
            오늘 학습을 모두 완료했어요! 내일 다시 만나요 😊
          </p>
        )}
      </div>

      {/* 스트릭 + 히트맵 */}
      <StreakBar
        streak={data.streak}
        longestStreak={data.longestStreak}
        studiedToday={data.studiedToday}
        heatmap={data.heatmap}
      />

      {/* 오늘의 학습 카드들 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {/* 리포트 입력 */}
        <TodoCard
          emoji="📋"
          title="리포트 입력"
          subtitle={data.hasSessionToday ? '오늘 리포트 입력 완료' : '오늘 대화 리포트를 붙여넣으세요'}
          done={data.hasSessionToday}
          estimatedMin={1}
          onClick={() => onNavigate('import')}
          accent="blue"
        />

        {/* 복습 */}
        <TodoCard
          emoji="🎯"
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
          emoji="✍️"
          title="문장 연습"
          subtitle={
            data.practiceCount === 0
              ? '오늘 연습할 문장 없음'
              : `교정 & Rewrite 총 ${data.practiceCount}개`
          }
          done={data.practiceCount === 0}
          estimatedMin={Math.ceil(data.practiceCount * 0.7)}
          count={data.practiceCount}
          onClick={() => onNavigate('practice')}
          accent="purple"
        />
      </div>

      {/* 미션 체크리스트 */}
      {data.pendingMissions.length > 0 && (
        <div style={{
          ...styles.card,
          padding: '1rem 1.25rem',
        }}>
          <h2 style={{ ...styles.sectionTitle, marginBottom: '0.6rem' }}>
            📋 Next Session 미션
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {data.pendingMissions.map(m => (
              <div key={m.id} style={{
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'flex-start',
                padding: '0.5rem 0.6rem',
                background: colors.surfaceAlt,
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
              }}>
                <span style={{ fontSize: '0.85rem', marginTop: '1px', flexShrink: 0 }}>☐</span>
                <p style={{ fontSize: '0.8rem', color: colors.text, lineHeight: 1.5, margin: 0 }}>
                  {m.suggestion}
                </p>
              </div>
            ))}
          </div>
          {data.pendingMissions.length === 3 && (
            <p style={{ fontSize: '0.7rem', color: colors.textSubtle, marginTop: '0.5rem' }}>
              * 최근 3개만 표시됩니다
            </p>
          )}
        </div>
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
  emoji, title, subtitle, done, estimatedMin, count, onClick, accent,
}: {
  emoji: string
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
        gap: '0.875rem',
        padding: '0.875rem 1rem',
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
      {/* 이모지 배경 */}
      <div style={{
        width: '2.5rem',
        height: '2.5rem',
        borderRadius: radius.md,
        background: done ? colors.surfaceAlt : a.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.2rem',
        flexShrink: 0,
        border: `1px solid ${done ? colors.border : a.border}`,
      }}>
        {done ? '✅' : emoji}
      </div>

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
