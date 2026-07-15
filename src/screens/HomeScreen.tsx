// HomeScreen.tsx — 통합 "오늘의 학습" 홈 화면
import { useEffect, useState } from 'react'
import { dueForReview } from '../db'
import { dueStudyItems } from '../db/study'
import { dueDrillCount, totalDrillCount } from '../db/drills'
import { getStreakInfo, hasSessionToday } from '../db/streak'
import { styles, colors, radius, type } from '../shared/styles'

interface HomeData {
  streak: number
  studiedToday: boolean
  reviewCount: number   // phrase + vocab
  practiceCount: number // correction + rewrite + 문제은행 드릴
  drillCount: number    // 문제은행 드릴만
  hasSessionToday: boolean
}

type Tab = 'import' | 'home' | 'review' | 'practice' | 'dashboard'

interface Props {
  onNavigate: (tab: Tab) => void
}

function greetingTitle(): string {
  const hour = new Date().getHours()
  if (hour < 12) return '좋은 아침이에요'
  if (hour < 18) return '안녕하세요'
  return '수고하셨어요'
}

export default function HomeScreen({ onNavigate }: Props) {
  const [data, setData] = useState<HomeData | null>(null)

  useEffect(() => {
    ; (async () => {
      const [streakInfo, { phrases, vocab }, studyItems, drillsDue, hasDrillBank, todayDone] =
        await Promise.all([
          getStreakInfo(),
          dueForReview(),
          dueStudyItems(),
          dueDrillCount(),
          totalDrillCount().then(n => n > 0),
          hasSessionToday(),
        ])

      // 문제은행이 있으면 연습 탭에서 정제 안 된 재작성(studyItems)은 더 이상
      // 보이지 않으므로(PracticeScreen 참고), 카운트에도 포함하지 않는다.
      setData({
        streak: streakInfo.streak,
        studiedToday: streakInfo.studiedToday,
        reviewCount: phrases.length + vocab.length,
        practiceCount: hasDrillBank ? drillsDue : studyItems.length,
        drillCount: hasDrillBank ? drillsDue : 0,
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

  const reportDone = data.hasSessionToday
  const reviewDone = data.reviewCount === 0
  const practiceDone = data.practiceCount === 0
  const doneCount = [reportDone, reviewDone, practiceDone].filter(Boolean).length
  const ringDeg = Math.round((doneCount / 3) * 360)

  const totalMin = (reportDone ? 0 : 1) + (reviewDone ? 0 : Math.ceil(data.reviewCount * 0.4)) + (practiceDone ? 0 : Math.ceil(data.practiceCount * 0.7))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} className="animate-fade-in">
      {/* 인사말 */}
      <div>
        <p style={localStyles.greetingTitle}>{greetingTitle()}</p>
        <p style={localStyles.greetingSubtitle}>
          {doneCount >= 3 ? '오늘 할 일을 모두 마쳤어요' : totalMin > 0 ? `오늘 ${totalMin}분이면 충분해요` : '오늘 리포트를 입력해보세요'}
        </p>
      </div>

      {/* 스트릭 링 게이지 */}
      <div style={localStyles.streakCard}>
        <div style={{ ...localStyles.ring, background: `conic-gradient(${colors.primary} 0deg ${ringDeg}deg, ${colors.surfaceAlt} ${ringDeg}deg 360deg)` }}>
          <div style={localStyles.ringInner}>
            <div style={localStyles.ringNum}>{data.streak}</div>
            <div style={localStyles.ringUnit}>일째</div>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <p style={localStyles.streakTitle}>연속 학습 {data.streak}일째</p>
          <p style={localStyles.streakSubtitle}>오늘 몫 3개 중 {doneCount}개 완료</p>
        </div>
      </div>

      {/* 오늘의 할 일 */}
      <p style={localStyles.sectionLabel}>오늘 할 일</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        <TodoCard
          title="리포트 입력"
          subtitle={reportDone ? '오늘 리포트 입력 완료' : '오늘 대화 리포트를 붙여넣으세요'}
          done={reportDone}
          estimatedMin={1}
          onClick={() => onNavigate('import')}
          accent="blue"
        />
        <TodoCard
          title="단어 복습"
          subtitle={reviewDone ? '오늘 복습할 카드 없음' : `Phrase · 어휘 ${data.reviewCount}장`}
          done={reviewDone}
          estimatedMin={Math.ceil(data.reviewCount * 0.4)}
          onClick={() => onNavigate('review')}
          accent="green"
        />
        <TodoCard
          title="문장 연습"
          subtitle={
            practiceDone
              ? '오늘 연습할 문장 없음'
              : data.drillCount > 0
                ? `오늘의 ${data.drillCount}문제`
                : `교정 · Rewrite ${data.practiceCount}개`
          }
          done={practiceDone}
          estimatedMin={Math.ceil(data.practiceCount * 0.7)}
          onClick={() => onNavigate('practice')}
          accent="strong"
        />
      </div>
    </div>
  )
}

// ── TodoCard 서브 컴포넌트 ──

type Accent = 'blue' | 'green' | 'strong'

const accentMap: Record<Accent, string> = {
  blue: colors.primary,
  green: colors.green,
  strong: colors.primaryStrong,
}

function TodoCard({
  title, subtitle, done, estimatedMin, onClick, accent,
}: {
  title: string
  subtitle: string
  done: boolean
  estimatedMin: number
  onClick: () => void
  accent: Accent
}) {
  return (
    <button
      onClick={onClick}
      style={{
        all: 'unset',
        display: 'flex',
        alignItems: 'center',
        gap: '0.875rem',
        padding: '1.125rem 1rem',
        borderRadius: radius.lg,
        background: colors.surface,
        boxShadow: 'var(--shadow-card)',
        cursor: 'pointer',
        boxSizing: 'border-box',
        opacity: done ? 0.6 : 1,
      }}
    >
      <div style={{
        width: '4px',
        alignSelf: 'stretch',
        borderRadius: radius.pill,
        background: accentMap[accent],
        flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: type.base,
          fontWeight: 700,
          color: colors.text,
          margin: 0,
          textDecoration: done ? 'line-through' : 'none',
        }}>
          {title}
        </p>
        <p style={{ fontSize: type.sm, color: colors.textMuted, margin: '2px 0 0' }}>
          {subtitle}
        </p>
      </div>
      {!done && estimatedMin > 0 && (
        <span style={{ fontSize: type.xs, color: colors.textSubtle, fontWeight: 600, flexShrink: 0 }}>
          ~{estimatedMin}분
        </span>
      )}
    </button>
  )
}

const localStyles = {
  greetingTitle: {
    fontSize: type.lg,
    fontWeight: 800,
    lineHeight: 1.4,
    color: colors.text,
    margin: 0,
  },
  greetingSubtitle: {
    fontSize: type.base,
    color: colors.textMuted,
    margin: '2px 0 0',
  },
  streakCard: {
    padding: '1.25rem',
    borderRadius: radius.xl,
    background: colors.surface,
    boxShadow: 'var(--shadow-card)',
    display: 'flex',
    alignItems: 'center',
    gap: '1.125rem',
  },
  ring: {
    width: '4rem',
    height: '4rem',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  ringInner: {
    width: '3.25rem',
    height: '3.25rem',
    borderRadius: '50%',
    background: colors.surface,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringNum: {
    fontSize: '1.125rem',
    fontWeight: 800,
    color: colors.primary,
    lineHeight: 1,
  },
  ringUnit: {
    fontSize: '0.56rem',
    color: colors.textSubtle,
    fontWeight: 600,
  },
  streakTitle: {
    fontSize: type.base,
    fontWeight: 700,
    color: colors.text,
    margin: 0,
  },
  streakSubtitle: {
    fontSize: type.sm,
    color: colors.textMuted,
    margin: '2px 0 0',
  },
  sectionLabel: {
    fontSize: type.sm,
    fontWeight: 700,
    color: colors.textMuted,
    margin: 0,
  },
} as const
