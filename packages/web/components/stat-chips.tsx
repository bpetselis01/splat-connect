import type { ReactNode } from 'react'

/**
 * A row of stat chips.
 *
 * §5.A of the design brief: "Never use a 4-tile stat grid — stats are a chip
 * row: <span> pill, big number + muted label." A grid of four equal cards reads
 * as four things of equal weight that you are meant to compare; a chip row reads
 * as a fact about the thing above it, which is what these always are.
 *
 * The icon is optional. With one it takes a tinted square, which is how the
 * homepage hero draws its three; without, the chip is just number and label.
 */
export interface Stat {
  label: string
  value: ReactNode
  icon?: ReactNode
  /** Tint behind the icon. Omit when there is no icon. */
  tint?: string
}

export function StatChips({ stats, className = '' }: { stats: Stat[]; className?: string }) {
  return (
    <ul className={`stat-chips ${className}`.trim()}>
      {stats.map((s) => (
        <li key={s.label} className="stat-chip">
          {s.icon ? (
            <span aria-hidden="true" className="stat-chip__icon" style={{ backgroundColor: s.tint }}>
              {s.icon}
            </span>
          ) : null}
          <span>
            <span className="stat-chip__value">{s.value}</span>{' '}
            <span className="stat-chip__label">{s.label}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
