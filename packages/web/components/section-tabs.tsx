'use client'
/**
 * The board's pill tab strip over a detail page's reference sections (the
 * guide's "Parts & tools / Files / Safety").
 *
 * Every panel is in the DOM and the inactive ones are `hidden`, so the server
 * render carries all of it — a reviewer's find-in-page and a no-JS visitor
 * both still reach the files.
 */
import { useId, useState, type ReactNode } from 'react'

export function SectionTabs({
  label,
  tabs,
}: {
  label: string
  tabs: { key: string; label: string; content: ReactNode }[]
}) {
  const [active, setActive] = useState(tabs[0]?.key)
  const id = useId()
  if (tabs.length === 0) return null

  return (
    <div className="flex flex-col gap-4">
      {/* One tab is no choice: draw the panel without the strip. */}
      {tabs.length > 1 && (
        <div role="tablist" aria-label={label} className="section-tabs">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`${id}-${t.key}-tab`}
              aria-controls={`${id}-${t.key}`}
              aria-selected={t.key === active}
              onClick={() => setActive(t.key)}
              className="section-tabs__tab"
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      {tabs.map((t) => (
        <div
          key={t.key}
          id={`${id}-${t.key}`}
          role={tabs.length > 1 ? 'tabpanel' : undefined}
          aria-labelledby={tabs.length > 1 ? `${id}-${t.key}-tab` : undefined}
          hidden={t.key !== active}
        >
          {t.content}
        </div>
      ))}
    </div>
  )
}
