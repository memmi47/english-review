// 디자인 시스템 — "Professional Calm" 팔레트
// 레퍼런스: Readwise · Notion · Linear
// 밝은 인디고/퍼플 → 딥 네이비로, 파란 빛 도는 배경 → 웜 아이보리로 교체

export const colors = {
  // 브랜드 — 깊은 네이비
  primary: '#1e3a5f',
  primaryHover: '#16304f',
  primaryLight: '#eaeff6',   // 네이비 아주 연하게

  // 배경 / 서피스
  bg: '#f4f3ef',             // 웜 아이보리 (파란 기 없음)
  surface: '#ffffff',
  surfaceAlt: '#f9f8f5',     // 카드 내부 중첩 영역

  // 텍스트
  text: '#1a2332',
  textMuted: '#6b7280',
  textSubtle: '#9ca3af',

  // 시맨틱
  green: '#166534',
  greenBg: '#f0fdf4',
  greenBorder: '#86efac',
  red: '#991b1b',
  redBg: '#fef2f2',
  redBorder: '#fca5a5',
  amber: '#78350f',
  amberBg: '#fffbeb',
  amberBorder: '#fcd34d',

  // UI 크롬
  border: '#dcd9d0',         // 웜 그레이 보더
  borderStrong: '#b5b0a5',
  divider: '#e8e5df',
}

export const radius = {
  sm: '0.375rem',
  md: '0.625rem',
  lg: '0.875rem',
  xl: '1.125rem',
  pill: '999px',
}

export const shadow = {
  card: '0 1px 3px rgba(26,35,50,0.07), 0 0 0 1px rgba(26,35,50,0.05)',
  cardHover: '0 4px 12px rgba(26,35,50,0.1), 0 0 0 1px rgba(26,35,50,0.06)',
}

export const styles = {
  page: {
    minHeight: '100vh',
    background: colors.bg,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '1.25rem 1rem 2rem',
    boxSizing: 'border-box' as const,
  },
  card: {
    background: colors.surface,
    borderRadius: radius.lg,
    padding: '1.25rem',
    boxShadow: shadow.card,
    border: `1px solid ${colors.border}`,
    width: '100%',
    maxWidth: '480px',
    height: 'fit-content',
    boxSizing: 'border-box' as const,
  },
  title: {
    fontSize: '1.125rem',
    fontWeight: 700,
    color: colors.text,
    margin: '0 0 0.2rem',
    letterSpacing: '-0.01em',
  },
  sectionTitle: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: colors.text,
    margin: '0 0 0.2rem',
    letterSpacing: '-0.01em',
  },
  subtitle: {
    fontSize: '0.8rem',
    color: colors.textMuted,
    margin: '0 0 1rem',
    lineHeight: 1.5,
  },
  button: {
    marginTop: '0.75rem',
    width: '100%',
    padding: '0.75rem',
    background: colors.primary,
    color: 'white',
    border: 'none',
    borderRadius: radius.md,
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    letterSpacing: '-0.01em',
    transition: 'opacity 0.15s',
  },
  secondaryButton: {
    marginTop: '0.75rem',
    width: '100%',
    padding: '0.75rem',
    background: colors.surface,
    color: colors.primary,
    border: `1.5px solid ${colors.border}`,
    borderRadius: radius.md,
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    letterSpacing: '-0.01em',
    transition: 'opacity 0.15s',
  },
  errorBox: {
    marginTop: '1rem',
    background: colors.redBg,
    border: `1px solid ${colors.redBorder}`,
    borderRadius: radius.md,
    padding: '0.875rem',
  },
  errorTitle: {
    fontWeight: 700,
    color: colors.red,
    margin: '0 0 0.5rem',
    fontSize: '0.875rem',
  },
  errorMsg: {
    color: colors.red,
    fontSize: '0.825rem',
    margin: '0.25rem 0 0',
    lineHeight: 1.5,
  },
  resultBox: {
    marginTop: '1rem',
    background: colors.greenBg,
    border: `1px solid ${colors.greenBorder}`,
    borderRadius: radius.md,
    padding: '0.875rem',
  },
  resultTitle: {
    fontWeight: 700,
    color: colors.green,
    margin: '0 0 0.75rem',
    fontSize: '0.875rem',
  },
  counts: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap' as const,
  },
  badge: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    background: colors.surface,
    border: `1px solid ${colors.greenBorder}`,
    borderRadius: radius.md,
    padding: '0.4rem 0.75rem',
    minWidth: '3.5rem',
  },
  badgeNum: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: colors.green,
    lineHeight: 1,
  },
  badgeLabel: {
    fontSize: '0.7rem',
    color: colors.textMuted,
    marginTop: '0.2rem',
  },
  warnBox: {
    marginTop: '0.75rem',
    background: colors.amberBg,
    border: `1px solid ${colors.amberBorder}`,
    borderRadius: radius.md,
    padding: '0.75rem',
  },
  warnTitle: {
    fontWeight: 600,
    color: colors.amber,
    margin: '0 0 0.5rem',
    fontSize: '0.825rem',
  },
  warnMsg: {
    color: '#78350f',
    fontSize: '0.775rem',
    margin: '0.2rem 0 0',
    lineHeight: 1.5,
  },
  divider: {
    height: '1px',
    background: colors.divider,
    margin: '1rem 0',
  },
} as const
