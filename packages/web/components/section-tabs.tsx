'use client'
/**
 * The board's pill tab strip over a detail page's reference sections (the
 * guide's "Parts & tools / Files / Safety").
 *
 * Every panel is in the DOM and the inactive ones are `hidden`, so the server
 * render carries all of it — a reviewer's find-in-page and a no-JS visitor
 * both still reach the files.
 */
import { useState, type ReactNode } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function SectionTabs({
  label,
  tabs,
}: {
  label: string
  tabs: { key: string; label: string; content: ReactNode }[]
}) {
  const [active, setActive] = useState(tabs[0]?.key)
  if (tabs.length === 0) return null
  // One tab is no choice: draw the panel without the strip.
  if (tabs.length === 1)
    return (
      <div className="flex flex-col gap-4">
        <div>{tabs[0].content}</div>
      </div>
    )

  return (
    <Tabs value={active} onValueChange={setActive} className="flex flex-col gap-4">
      <TabsList aria-label={label} className="section-tabs">
        {tabs.map((t) => (
          <TabsTrigger key={t.key} value={t.key} className="section-tabs__tab">
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {/* forceMount + hidden rather than Radix's unmount: see the header. */}
      {tabs.map((t) => (
        <TabsContent key={t.key} value={t.key} forceMount hidden={t.key !== active}>
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}
