'use client'
import { useId } from 'react'
import {
  ArrowsDownUp,
  CaretDown,
  Check,
  SortAscending,
  SortDescending,
} from '@phosphor-icons/react/dist/ssr'

export type SortDir = 'asc' | 'desc'

export interface SortOption<K extends string> {
  key: K
  label: string
  hint: string
  /** What the flip button reads in each direction: [ascending, descending]. */
  labels: [asc: string, desc: string]
}

/** The board's sort control: a menu that picks the field, and a round button
 *  beside it that flips the direction. */
export function SortControl<K extends string>({
  sorts,
  label,
  sortKey,
  dir,
  onPick,
  onFlip,
}: {
  sorts: SortOption<K>[]
  /** The menu's accessible name: "Sort guides by". */
  label: string
  sortKey: K
  dir: SortDir
  onPick: (key: K) => void
  onFlip: () => void
}) {
  const menuId = useId()
  const current = sorts.find((s) => s.key === sortKey)!
  // The label names where the button takes you, not where you are.
  const flipLabel = `Switch to ${current.labels[dir === 'asc' ? 1 : 0].toLowerCase()}`

  return (
    // A native popover: the browser handles Escape, a press outside and
    // aria-expanded on the trigger.
    <div className="sort-control">
      <button type="button" popoverTarget={menuId} className="sort-control__trigger">
        <ArrowsDownUp size={15} weight="bold" className="text-brand-dark" aria-hidden="true" />
        {/* The board names the order you are in ("Newest first"), not the
            field; the menu below is where the fields are named. */}
        {current.labels[dir === 'asc' ? 0 : 1]}
        <CaretDown size={13} weight="bold" className="text-muted" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onFlip}
        aria-label={flipLabel}
        title={flipLabel}
        className="sort-control__flip"
      >
        {dir === 'asc' ? (
          <SortAscending size={18} weight="bold" aria-hidden="true" />
        ) : (
          <SortDescending size={18} weight="bold" aria-hidden="true" />
        )}
      </button>
      <div id={menuId} popover="auto" role="group" aria-label={label} className="sort-control__menu">
        {sorts.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={s.key === sortKey}
            popoverTarget={menuId}
            popoverTargetAction="hide"
            onClick={() => onPick(s.key)}
            className="sort-control__option"
          >
            <span className="flex flex-col gap-px">
              <span className="text-sm font-extrabold">{s.label}</span>
              <span className="text-xs font-semibold text-muted">{s.hint}</span>
            </span>
            <Check
              size={16}
              weight="bold"
              className="text-brand-dark"
              style={{ opacity: s.key === sortKey ? 1 : 0 }}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
    </div>
  )
}
