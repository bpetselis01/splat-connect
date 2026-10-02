'use client'
import { useState, type ReactNode } from 'react'

/**
 * The browse pages' filter rail — guides, toys, printers. On a phone the rail
 * stacks above the results and ran to 600px before the first card, so below
 * 640px everything under the heading row folds behind Show; CSS alone decides
 * whether the fold applies, so the rail is unchanged at any other width.
 */
export function BrowseFilters({ onClear, children }: { onClear: () => void; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <aside aria-label="Filters" className="browse-filters" data-open={open || undefined}>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-extrabold text-ink">Filters</h2>
        <span className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClear}
            className="min-h-9 text-sm font-bold text-brand-deep"
          >
            Clear
          </button>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="browse-filters__toggle chip"
          >
            {open ? 'Hide' : 'Show'}
            <span className="sr-only"> filters</span>
          </button>
        </span>
      </div>
      {children}
    </aside>
  )
}
