// styles.ts — CSS 변수 기반 디자인 토큰 & 공통 스타일
// index.css의 CSS custom properties를 참조한다.
// 다크모드는 [data-theme="dark"]로 자동 전환되므로 JS에서 별도 분기 불필요.

export const colors = {
  // CSS 변수 참조값 (JS inline style에서 사용)
  primary:       'var(--primary)',
  primaryHover:  'var(--primary-hover)',
  primaryStrong: 'var(--primary-strong)',
  primaryLight:  'var(--primary-light)',
  primarySoft:   'var(--primary-soft)',

  bg:            'var(--bg)',
  surface:       'var(--surface)',
  surfaceAlt:    'var(--surface-alt)',
  surfaceSunken: 'var(--surface-sunken)',

  text:        'var(--text)',
  textMuted:   'var(--text-muted)',
  textSubtle:  'var(--text-subtle)',

  green:       'var(--green)',
  greenBg:     'var(--green-bg)',
  greenBorder: 'var(--green-border)',
  red:         'var(--red)',
  redBg:       'var(--red-bg)',
  redBorder:   'var(--red-border)',
  amber:       'var(--amber)',
  amberBg:     'var(--amber-bg)',
  amberBorder: 'var(--amber-border)',
  purple:      'var(--purple)',
  purpleBg:    'var(--purple-bg)',
  purpleBorder:'var(--purple-border)',

  border:       'var(--border)',
  borderStrong: 'var(--border-strong)',
  divider:      'var(--divider)',
}

export const radius = {
  sm:   'var(--radius-sm)',
  md:   'var(--radius-md)',
  lg:   'var(--radius-lg)',
  xl:   'var(--radius-xl)',
  pill: 'var(--radius-pill)',
}

export const shadow = {
  card:      'var(--shadow-card)',
  cardHover: 'var(--shadow-card-hover)',
}

// 타이포 스케일 — 본문 최소 17px, 문제/타이틀은 md~display
export const type = {
  xs:      'var(--text-xs)',
  sm:      'var(--text-sm)',
  base:    'var(--text-base)',
  md:      'var(--text-md)',
  lg:      'var(--text-lg)',
  xl:      'var(--text-xl)',
  display: 'var(--text-display)',
}

export const space = {
  s1: 'var(--space-1)',
  s2: 'var(--space-2)',
  s3: 'var(--space-3)',
  s4: 'var(--space-4)',
  s5: 'var(--space-5)',
  s6: 'var(--space-6)',
  s7: 'var(--space-7)',
}

// ── 공통 컴포넌트 스타일 ──

export const styles = {
  page: {
    minHeight: '100dvh',
    background: colors.bg,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '0.75rem 1rem 1rem',
    boxSizing: 'border-box' as const,
  },
  card: {
    background: colors.surface,
    borderRadius: radius.lg,
    padding: '1.25rem',
    boxShadow: shadow.card,
    border: `1px solid ${colors.border}`,
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  title: {
    fontSize: '1.125rem',
    fontWeight: 700,
    color: colors.text,
    margin: '0 0 0.2rem',
    letterSpacing: '-0.02em',
    lineHeight: 1.3,
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
    padding: '0.8rem',
    background: colors.primary,
    color: 'white',
    border: 'none',
    borderRadius: radius.md,
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    letterSpacing: '-0.01em',
    transition: 'opacity 0.15s, transform 0.1s',
    fontFamily: 'inherit',
  },
  secondaryButton: {
    marginTop: '0.75rem',
    width: '100%',
    padding: '0.8rem',
    background: colors.surface,
    color: colors.primary,
    border: `1.5px solid ${colors.border}`,
    borderRadius: radius.md,
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    letterSpacing: '-0.01em',
    transition: 'opacity 0.15s',
    fontFamily: 'inherit',
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
    color: colors.amber,
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
