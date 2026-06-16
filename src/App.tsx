import { useState } from 'react'
import ImportScreen from './screens/ImportScreen'
import DashboardScreen from './screens/DashboardScreen'
import ReviewScreen from './screens/ReviewScreen'
import { colors } from './shared/styles'

type Tab = 'import' | 'dashboard' | 'review'

export default function App() {
  const [tab, setTab] = useState<Tab>('import')

  return (
    <div style={styles.page}>
      <div style={styles.nav}>
        <NavButton label="📋 가져오기" active={tab === 'import'} onClick={() => setTab('import')} />
        <NavButton label="📊 대시보드" active={tab === 'dashboard'} onClick={() => setTab('dashboard')} />
        <NavButton label="🎯 복습" active={tab === 'review'} onClick={() => setTab('review')} />
      </div>

      <div style={styles.content}>
        {tab === 'import' && <ImportScreen />}
        {tab === 'dashboard' && <DashboardScreen onGoReview={() => setTab('review')} />}
        {tab === 'review' && <ReviewScreen />}
      </div>
    </div>
  )
}

function NavButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.navButton,
        background: active ? colors.primary : 'white',
        color: active ? 'white' : colors.primary,
      }}
    >
      {label}
    </button>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: colors.bg,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '1rem',
    boxSizing: 'border-box' as const,
  },
  nav: {
    display: 'flex',
    gap: '0.5rem',
    width: '100%',
    maxWidth: '480px',
    marginBottom: '1rem',
  },
  navButton: {
    flex: 1,
    padding: '0.6rem 0.5rem',
    borderRadius: '0.75rem',
    border: `1.5px solid ${colors.primary}`,
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
  },
  content: {
    width: '100%',
    maxWidth: '480px',
    display: 'flex',
    flexDirection: 'column' as const,
  },
} as const
