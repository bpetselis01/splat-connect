// packages/mobile/lib/org-lists.ts
// The doors and rate lines as the API takes them, or the sentence to show.
// Same rules as web's readLists (components/org-profile-parts.tsx).
import { dollarsToCents, type OrgDoorTarget } from '@splat-connect/types'

export const MAX_DOORS = 6
export const MAX_RATE_LINES = 20

export type DoorDraft = { key: string; title: string; body: string; target: OrgDoorTarget }
export type RateDraft = { key: string; description: string; amount: string; claiming: boolean }

type Lists = {
  doors: Array<{ title: string; body: string; target: OrgDoorTarget }>
  lines: Array<{ description: string; amount_cents: number; claiming: boolean }>
}

export function readLists(doors: DoorDraft[], lines: RateDraft[], rateNote: string): { error: string } | Lists {
  const keptDoors = doors.filter((d) => d.title.trim() || d.body.trim())
  if (keptDoors.some((d) => !d.title.trim())) return { error: 'Every door needs a title.' }
  const keptLines = lines.filter((l) => l.description.trim() || l.amount.trim())
  const out: Array<{ description: string; amount_cents: number; claiming: boolean }> = []
  for (const l of keptLines) {
    const description = l.description.trim()
    if (!description) return { error: 'Every cost line needs a description.' }
    const cents = dollarsToCents(l.amount || '0')
    if (cents === null) return { error: `"${description}" needs an amount in dollars.` }
    out.push({ description, amount_cents: cents, claiming: l.claiming })
  }
  if (out.length > 0 && !rateNote.trim()) return { error: 'Say why these costs, in a sentence or two.' }
  return {
    doors: keptDoors.map((d) => ({ title: d.title.trim(), body: d.body.trim(), target: d.target })),
    lines: out,
  }
}
