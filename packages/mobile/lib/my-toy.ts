// packages/mobile/lib/my-toy.ts
import type { Toy } from '@splat-connect/types'
import { gradeOf } from '@splat-connect/types'
import { apiClient } from './api-client'

/**
 * One toy the caller holds — personally, or for an organisation they lead —
 * and the rest of that holder's shelf. toys.ts has no single-row GET, and
 * GET /api/toys is the caller's own toys only: an org toy is on
 * /api/toys/inventory, so it is read only when the first list lacks it.
 */
export async function loadOwnedToy(id: string): Promise<{ toy: Toy; shelf: Toy[] } | null> {
  const mine = await apiClient.get<Toy[]>('/api/toys')
  const own = mine.find((t) => t.id === id)
  if (own) return { toy: own, shelf: mine }
  const inventory = await apiClient.get<Toy[]>('/api/toys/inventory')
  const held = inventory.find((t) => t.id === id)
  return held ? { toy: held, shelf: inventory.filter((t) => t.owner_org_id === held.owner_org_id) } : null
}

/**
 * The board's lead for one of your toys: "Light-up drum — listed 4 June, good
 * condition, switch-adapted. Two families have asked for it." A draft is not
 * listed, so it says only the name.
 */
export function toySummaryLead(
  toy: Pick<Toy, 'name' | 'condition' | 'switch_adapted' | 'status' | 'created_at'>,
  asks: number
): string {
  const head =
    toy.status === 'published'
      ? `${toy.name} — listed ${new Date(toy.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })}`
      : toy.name
  const facts = [head, `${gradeOf(toy.condition).label.toLowerCase()} condition`, toy.switch_adapted ? 'switch-adapted' : null]
    .filter(Boolean)
    .join(', ')
  const asked = asks === 0 ? '' : ` ${asks} ${asks === 1 ? 'family has' : 'families have'} asked for it.`
  return `${facts}.${asked}`
}
