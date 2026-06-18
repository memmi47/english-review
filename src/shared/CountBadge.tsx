import { styles } from './styles'

export function CountBadge({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.badge}>
      <span style={styles.badgeNum}>{value}</span>
      <span style={styles.badgeLabel}>{label}</span>
    </div>
  )
}
