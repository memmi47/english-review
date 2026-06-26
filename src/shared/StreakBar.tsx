// StreakBar.tsx — 연속 학습일 + 7x10 히트맵
import { colors, radius } from './styles'

interface Props {
  streak: number
  longestStreak: number
  studiedToday: boolean
  heatmap: Record<string, boolean> // { 'YYYY-MM-DD': boolean }
  stats: {
    studyDays: number
    sessions: number
    corrections: number
    phrases: number
  }
}

// 최근 70일을 7열(요일) × 10주로 렌더링
function HeatmapGrid({ heatmap }: { heatmap: Record<string, boolean> }) {
  const today = new Date()
  // 오늘 포함 70일치 날짜 (최신 → 오래된 순)
  const days: { key: string; studied: boolean; isToday: boolean }[] = []
  for (let i = 69; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    days.push({ key, studied: heatmap[key] ?? false, isToday: i === 0 })
  }

  // 7열 → 10행
  const weeks: typeof days[] = []
  for (let w = 0; w < 10; w++) {
    weeks.push(days.slice(w * 7, w * 7 + 7))
  }

  return (
    <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
      {weeks.map((week, wi) => (
        <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {week.map(day => (
            <div
              key={day.key}
              title={day.key}
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '2px',
                background: day.isToday
                  ? 'var(--primary)'
                  : day.studied
                  ? 'rgba(30,58,95,0.65)'
                  : 'var(--surface-alt)',
                border: day.isToday ? '1.5px solid var(--primary)' : `1px solid var(--border)`,
                boxSizing: 'border-box',
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function StreakBar({ streak, longestStreak, studiedToday, heatmap, stats }: Props) {
  const statusText = studiedToday ? '오늘 완료' : '오늘 미완료'

  return (
    <div style={{
      background: colors.surface,
      borderRadius: radius.lg,
      padding: '1rem 1.25rem',
      boxShadow: 'var(--shadow-card)',
      border: `1px solid ${colors.border}`,
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1.05fr) minmax(8.5rem, 0.95fr)',
      gap: '1rem',
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: colors.textSubtle, fontWeight: 700, marginBottom: '0.25rem' }}>
              학습 연속성
            </div>
            <div style={{
              fontSize: '1.9rem',
              fontWeight: 800,
              color: colors.primary,
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}>
              {streak}일
            </div>
            <div style={{ fontSize: '0.72rem', color: colors.textMuted, marginTop: '0.25rem' }}>
              최장 {longestStreak}일
            </div>
          </div>
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            padding: '0.2rem 0.6rem',
            borderRadius: radius.pill,
            background: studiedToday ? colors.greenBg : colors.amberBg,
            color: studiedToday ? colors.green : colors.amber,
            border: `1px solid ${studiedToday ? colors.greenBorder : colors.amberBorder}`,
            whiteSpace: 'nowrap',
          }}>
            {statusText}
          </span>
        </div>

        <div style={{ fontSize: '0.68rem', color: colors.textSubtle, marginBottom: '6px', fontWeight: 500 }}>
          최근 10주
        </div>
        <HeatmapGrid heatmap={heatmap} />
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '6px' }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(30,58,95,0.65)', border: '1px solid var(--border)' }} />
          <span style={{ fontSize: '0.65rem', color: colors.textSubtle }}>학습 완료</span>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--surface-alt)', border: '1px solid var(--border)', marginLeft: 4 }} />
          <span style={{ fontSize: '0.65rem', color: colors.textSubtle }}>미완료</span>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--primary)', border: '1.5px solid var(--primary)', marginLeft: 4, boxSizing: 'border-box' }} />
          <span style={{ fontSize: '0.65rem', color: colors.textSubtle }}>오늘</span>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '0.45rem',
        alignContent: 'start',
      }}>
        <StatTile label="총 학습일" value={`${stats.studyDays}일`} />
        <StatTile label="세션" value={`${stats.sessions}회`} />
        <StatTile label="교정" value={`${stats.corrections}개`} />
        <StatTile label="표현" value={`${stats.phrases}개`} />
      </div>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: colors.surfaceAlt,
      border: `1px solid ${colors.border}`,
      borderRadius: radius.md,
      padding: '0.55rem 0.6rem',
      minHeight: '3.2rem',
    }}>
      <div style={{ fontSize: '0.65rem', color: colors.textSubtle, fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ fontSize: '0.96rem', color: colors.text, fontWeight: 800, marginTop: '0.15rem', letterSpacing: '-0.01em' }}>
        {value}
      </div>
    </div>
  )
}
