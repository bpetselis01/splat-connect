'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'

export interface ProfileTab {
  key: string
  label: string
  content: ReactNode
}

/**
 * Pill tab row over pre-rendered content. No fetching here — the server
 * component that renders each tab's content up front, this just switches
 * which one is visible.
 */
export function ProfileTabs({ tabs }: { tabs: ProfileTab[] }) {
  const [activeKey, setActiveKey] = useState(tabs[0]?.key)
  const active = tabs.find((t) => t.key === activeKey) ?? tabs[0]

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
