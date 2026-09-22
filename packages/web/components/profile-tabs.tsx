'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'

export interface ProfileTab {
  key: string
  label: string
  content: ReactNode
  /** A coral count beside the label, shown when above zero. Segmented only. */
  count?: number
  /** A glyph before the label. Segmented only. */
  icon?: ReactNode
}

/**
 * Pill tab row over pre-rendered content. No fetching here — the server
 * component that renders each tab's content up front, this just switches
 * which one is visible.
 */
export function ProfileTabs({
  tabs,
  defaultKey,
  variant = 'pills',
  label,
}: {
  tabs: ProfileTab[]
  defaultKey?: string
  /** `segmented` is the board's track-and-thumb control: one --surface2 pill
   *  with the active tab raised on --surface. */
  variant?: 'pills' | 'segmented'
  label?: string
}) {
  const [activeKey, setActiveKey] = useState(defaultKey ?? tabs[0]?.key)
  const active = tabs.find((t) => t.key === activeKey) ?? tabs[0]

  if (variant === 'segmented') {
    return (
      <div>
        <div
          role="tablist"
          aria-label={label}
          className="flex w-max max-w-full gap-1 overflow-x-auto rounded-full bg-[var(--surface2)] p-1"
        >
          {tabs.map((tab) => {
            const on = tab.key === active?.key
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setActiveKey(tab.key)}
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-[18px] text-[15px] font-extrabold text-ink transition-all ${
                  on ? 'bg-surface shadow-[var(--shadow-e1)]' : 'bg-transparent'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.count ? (
                  <span className="h-[22px] min-w-[22px] rounded-full bg-[var(--coral)] px-1.5 text-center text-xs font-extrabold leading-[22px] text-white">
                    {tab.count}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
        <div key={active?.key} className="mt-[22px]">
          {active?.content}
        </div>
      </div>
    )
  }

  return (
    <div className="mt-6">
      {/* pr-1.5 is the room the buttons' 4px hard shadow needs — a scroll
          container clips at its padding edge, and with pr-0 the last tab lost
          its shadow flat against that edge. pb-1 (4px) already cleared it. */}
      <div role="tablist" className="flex gap-2 overflow-x-auto pb-1 pr-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={tab.key === active?.key}
            onClick={() => setActiveKey(tab.key)}
            className={`btn btn-sm shrink-0 ${
              tab.key === active?.key ? 'btn-primary' : 'btn-quiet'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {/* Keyed on the tab, so React remounts rather than reconciling one tab's
          tree onto the next. Without it a controlled input in one tab could
          land on the DOM node of an uncontrolled one in another — which is
          exactly the warning the events/stories editor started throwing when
          its two forms sat at the same position in their trees. */}
      <div key={active?.key} className="mt-4">
        {active?.content}
      </div>
    </div>
  )
}
