import { useEffect, useState } from 'react'
import HomeScreen from './screens/HomeScreen'
import ImportScreen from './screens/ImportScreen'
import DashboardScreen from './screens/DashboardScreen'
import ReviewScreen from './screens/ReviewScreen'
import PracticeScreen from './screens/PracticeScreen'
import { TtsErrorToast } from './shared/TtsErrorToast'
import { colors, radius } from './shared/styles'

type Tab = 'home' | 'review' | 'practice' | 'dashboard' | 'import'

const TABS: { id: Tab; label: string }[] = [
  { id: 'home',      label: '홈' },
  { id: 'review',    label: '복습' },
  { id: 'practice',  label: '연습' },
  { id: 'dashboard', label: '분석' },
  { id: 'import',    label: '입력' },
]

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
  const [pressedTab, setPressedTab] = useState<Tab | null>(null)
  const [dark, toggleDark] = useDarkMode()
  const activeIndex = TABS.findIndex(t => t.id === tab)

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
          padding: '0.8rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <img
              src="/favicon.svg"
              alt=""
              aria-hidden="true"
              style={{
                width: '1.55rem',
                height: '1.55rem',
                display: 'block',
                flexShrink: 0,
              }}
            />
            <span style={{
              fontSize: '1.08rem',
              fontWeight: 700,
              color: colors.text,
              letterSpacing: '0',
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
        {tab === 'review'    && <ReviewScreen onGoPractice={() => setTab('practice')} />}
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
        overflow: 'hidden',
        boxShadow: '0 -1px 0 var(--border), 0 -8px 24px rgba(15,23,42,0.06)',
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: `${(Math.max(activeIndex, 0) + 0.5) * (100 / TABS.length)}%`,
          transform: 'translateX(-50%)',
          width: '2.25rem',
          height: '3px',
          background: colors.primary,
          borderRadius: '0 0 2px 2px',
          transition: 'left 0.24s cubic-bezier(0.2, 0.8, 0.2, 1), width 0.18s ease',
        }} />
        {TABS.map(({ id, label }) => (
          <TabButton
            key={id}
            label={label}
            active={tab === id}
            pressed={pressedTab === id}
            onPressStart={() => setPressedTab(id)}
            onPressEnd={() => setPressedTab(current => current === id ? null : current)}
            onClick={() => setTab(id)}
          />
        ))}
      </nav>

      <TtsErrorToast />
    </div>
  )
}

function TabButton({
  label, active, pressed, onPressStart, onPressEnd, onClick,
}: {
  label: string
  active: boolean
  pressed: boolean
  onPressStart: () => void
  onPressEnd: () => void
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      onPointerDown={onPressStart}
      onPointerUp={onPressEnd}
      onPointerCancel={onPressEnd}
      onPointerLeave={onPressEnd}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.35rem',
        padding: '0.75rem 0.25rem 0.85rem',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        minHeight: '68px',
        position: 'relative',
        fontFamily: 'inherit',
        WebkitTapHighlightColor: 'transparent',
        transform: pressed ? 'translateY(1px) scale(0.97)' : active ? 'translateY(-1px)' : 'translateY(0)',
        transition: 'transform 0.12s ease, background 0.16s ease',
      }}
    >
      <span style={{
        width: '6px',
        height: '6px',
        borderRadius: radius.pill,
        background: active ? colors.primary : 'transparent',
        transform: active ? 'scale(1)' : 'scale(0.45)',
        transition: 'background 0.18s ease, transform 0.18s ease',
      }} />
      <span style={{
        fontSize: '0.96rem',
        fontWeight: active ? 700 : 500,
        color: active ? colors.primary : colors.textSubtle,
        letterSpacing: '0',
        transition: 'color 0.15s, font-weight 0.15s',
      }}>
        {label}
      </span>
    </button>
  )
}
