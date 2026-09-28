import type { ReactNode } from 'react'

/** The browse pages' filter rail — guides, toys, printers. */
export function BrowseFilters({ onClear, children }: { onClear: () => void; children: ReactNode }) {
  return (
    <aside aria-label="Filters" className="browse-filters">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-extrabold text-ink">Filters</h2>
        <button
          type="button"
          onClick={onClear}
          className="min-h-9 text-sm font-bold text-brand-deep"
        >
          Clear
        </button>
      </div>
      {children}
    </aside>
  )
}
