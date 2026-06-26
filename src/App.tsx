import { useEffect, useState } from 'react'
import HomeScreen from './screens/HomeScreen'
import ImportScreen from './screens/ImportScreen'
import DashboardScreen from './screens/DashboardScreen'
import ReviewScreen from './screens/ReviewScreen'
import PracticeScreen from './screens/PracticeScreen'
import { colors, radius } from './shared/styles'

type Tab = 'home' | 'review' | 'practice' | 'dashboard' | 'import'

// 다크모드: localStorage 기반 영속성
function useDarkMode(): [boolean, () => void] {
  const [dark, setDark] = useState<boolean>(() => {
    try { return localStorage.getItem('theme') === 'dark' } catch { return false }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    try { localStorage.setItem('theme', dark ? 'dark' : 'light') } catch { /* noop */ }
  }, [dark])

  return [dark, () => setDark(d => !d)]
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [dark, toggleDark] = useDarkMode()

  return (
    <div style={{ minHeight: '100dvh', background: colors.bg, display: 'flex', flexDirection: 'column' }}>
      {/* ── 상단 헤더 ── */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: colors.surface,
        borderBottom: `1px solid ${colors.border}`,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}>
        <div style={{
          maxWidth: '480px',
          margin: '0 auto',
          padding: '0.6rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{
              width: '1.7rem',
              height: '1.7rem',
              borderRadius: radius.sm,
              background: colors.primary,
              color: '#fff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.68rem',
              fontWeight: 800,
              letterSpacing: '0',
            }}>
              ER
            </span>
            <span style={{
              fontSize: '0.95rem',
              fontWeight: 700,
              color: colors.text,
              letterSpacing: '-0.02em',
            }}>
              English Review
            </span>
          </div>
          {/* 다크모드 토글 */}
          <button
            onClick={toggleDark}
            aria-label="다크모드 전환"
            style={{
              background: colors.surfaceAlt,
              border: `1px solid ${colors.border}`,
              borderRadius: radius.pill,
              padding: '0.3rem 0.65rem',
              fontSize: '0.72rem',
              color: colors.textMuted,
              cursor: 'pointer',
              transition: 'background 0.2s',
              lineHeight: 1,
              fontFamily: 'inherit',
            }}
          >
            {dark ? 'Light' : 'Dark'}
          </button>
        </div>
      </header>

      {/* ── 메인 콘텐츠 ── */}
      <main style={{
        flex: 1,
        maxWidth: '480px',
        width: '100%',
        margin: '0 auto',
        padding: '0.75rem 1rem 1rem',
        boxSizing: 'border-box',
      }}>
        {tab === 'home'      && <HomeScreen onNavigate={setTab} />}
        {tab === 'review'    && <ReviewScreen />}
        {tab === 'practice'  && <PracticeScreen />}
        {tab === 'dashboard' && <DashboardScreen onGoReview={() => setTab('review')} />}
        {tab === 'import'    && <ImportScreen onGoReview={() => setTab('review')} />}
      </main>

      {/* ── 하단 탭 바 ── */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '480px',
        background: colors.surface,
        borderTop: `1px solid ${colors.border}`,
        display: 'flex',
        alignItems: 'stretch',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        zIndex: 50,
        boxShadow: '0 -1px 0 var(--border), 0 -4px 16px rgba(0,0,0,0.06)',
      }}>
        {([
          { id: 'home',      icon: 'HM', label: '홈' },
          { id: 'review',    icon: 'RV', label: '복습' },
          { id: 'practice',  icon: 'PR', label: '연습' },
          { id: 'dashboard', icon: 'IN', label: '분석' },
          { id: 'import',    icon: 'IM', label: '입력' },
        ] as { id: Tab; icon: string; label: string }[]).map(({ id, icon, label }) => (
          <TabButton
            key={id}
            icon={icon}
            label={label}
            active={tab === id}
            onClick={() => setTab(id)}
          />
        ))}
      </nav>
    </div>
  )
}

function TabButton({
  icon, label, active, onClick,
}: {
  icon: string
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2px',
        padding: '0.5rem 0.25rem',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        minHeight: '56px',
        position: 'relative',
        fontFamily: 'inherit',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* 활성 인디케이터 */}
      {active && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '32px',
          height: '2.5px',
          background: colors.primary,
          borderRadius: '0 0 2px 2px',
          transition: 'width 0.2s',
        }} />
      )}
      <span style={{
        fontSize: '0.62rem',
        lineHeight: 1,
        fontWeight: 800,
        letterSpacing: '0',
        color: active ? colors.primary : colors.textSubtle,
      }}>{icon}</span>
      <span style={{
        fontSize: '0.62rem',
        fontWeight: active ? 700 : 500,
        color: active ? colors.primary : colors.textSubtle,
        letterSpacing: '-0.01em',
        transition: 'color 0.15s, font-weight 0.15s',
      }}>
        {label}
      </span>
    </button>
  )
}
