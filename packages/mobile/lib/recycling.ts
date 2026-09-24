// The rules both recycling screens lean on, pulled out so they can be tested
// without rendering. Every one mirrors the API (packages/api/src/routes/
// organizations.ts, "the recycling") or web (components/dropoff-form.tsx,
// components/recycling-intake.tsx) — a client that disagrees with either books
// a drop the server refuses or offers a button that 400s.
import type { DropoffStatus, Organization, RecyclingDropoff } from '@splat-connect/types'
import { kgToGrams, MIN_DROPOFF_GRAMS, RECYCLING_DECLARATION } from '@splat-connect/types'

export type TakerOrg = Pick<Organization, 'id' | 'name' | 'status' | 'suburb' | 'state'> & {
  recycling_materials?: string[]
  recycling_note?: string | null
}

/**
 * Who can take plastic: an organisation that has published at least one
 * polymer. An empty list is one whose first booking field has no valid answer.
 * Suspended ones are left out too — web lists them (its directory marks rather
 * than hides), but a booking form is not a directory, and a drop-off booked
 * with an organisation that cannot operate is plastic in somebody's car boot.
 */
export function takers<T extends TakerOrg>(orgs: T[]): T[] {
  return orgs.filter((o) => (o.recycling_materials ?? []).length > 0 && o.status !== 'suspended')
}

/** Grams as the board prints kilos: one decimal. */
export const kg = (grams: number) => `${(grams / 1000).toFixed(1)} kg`

/**
 * Why the booking cannot go yet, or null when it can. The order is the order
 * the form reads in, so the line under the button names the first thing left.
 */
export function bookingProblem(input: { grams: number | null; material: string; ticked: number }): string | null {
  if (input.grams === null || input.grams < MIN_DROPOFF_GRAMS) {
    return `A drop needs to be at least ${MIN_DROPOFF_GRAMS / 1000} kg.`
  }
  if (!input.material) return 'Pick the polymer you are bringing.'
  const left = RECYCLING_DECLARATION.length - input.ticked
  if (left > 0) return `${left} declaration line${left === 1 ? '' : 's'} still to tick.`
  return null
}

/**
 * The intake row's two boxes, checked the way the API checks them: whole
 * grams, not negative, and no yield turns two kilos into three. Returns the
 * grams to send, or the sentence to show.
 */
export function intakeProblem(
  weighed: string,
  credit: string
): { ok: true; weighed_grams: number; credit_grams: number } | { ok: false; message: string } {
  const w = kgToGrams(weighed)
  const c = kgToGrams(credit)
  if (w === null) return { ok: false, message: 'Enter what it weighed, in kilos.' }
  if (c === null) return { ok: false, message: 'Enter the credit, in kilos.' }
  if (c > w) return { ok: false, message: 'Credit cannot be more than what was weighed.' }
  return { ok: true, weighed_grams: w, credit_grams: c }
}

/**
 * Status → the row's pill, and whether the leader still has a decision to make.
 * Only a booked drop-off can be weighed or turned away: the API would take a
 * second PATCH on a received one, and that is a credit rewritten after the
 * fact rather than a decision.
 */
export const DROPOFF_PILL: Record<DropoffStatus, { label: string; badge: string }> = {
  booked: { label: 'Booked in', badge: 'pending' },
  received: { label: 'Credited', badge: 'completed' },
  declined: { label: 'Turned away', badge: 'rejected' },
  cancelled: { label: 'Cancelled', badge: 'withdrawn' },
}

export const canDecide = (d: Pick<RecyclingDropoff, 'status'>) => d.status === 'booked'

/** Weighed kilos only: a declined bag went back in the car, and a booked one
 *  has not been anywhere yet. */
export function diverted(drops: RecyclingDropoff[]) {
  const received = drops.filter((d) => d.status === 'received')
  return {
    grams: received.reduce((a, d) => a + (d.weighed_grams ?? 0), 0),
    credit: received.reduce((a, d) => a + (d.credit_grams ?? 0), 0),
  }
}

/** The board's four milestones, earned on weighed kilos. */
export function badges(grams: number) {
  return (
    [
      [100, 'First drop'],
      [5000, '5 kg diverted'],
      [25000, '25 kg diverted'],
      [100000, '100 kg diverted'],
    ] as const
  ).map(([at, label]) => ({
    label,
    earned: grams >= at,
    sub: grams >= at ? 'Earned' : `${kg(at - grams)} to go`,
  }))
}
