// packages/mobile/lib/printing.ts
/**
 * The rules the printing screens share, kept out of the components so the
 * tests can hold them without rendering anything: how picks are counted, what
 * a job is called at each stage, and which of an organisation's machines fits
 * a job best.
 *
 * Every figure here comes off the rows the API returns. Where the board draws
 * something the API has no source for (distance, a verified flag, part
 * dimensions) it is left out rather than faked.
 */
import type { PrinterWithOwner, PrintJobFile, ToyTransaction } from '@splat-connect/types'
import { MAX_PRINTERS_PER_REQUEST, printStep } from '@splat-connect/types'

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Taking jobs and has a free slot. Either alone closes the machine (058). */
export const isOpen = (p: Pick<PrinterWithOwner, 'accepting' | 'open_jobs' | 'capacity'>) =>
  p.accepting && p.open_jobs < p.capacity

/**
 * Pick or unpick a printer. A fourth pick is refused rather than bumping the
 * first out — silently dropping somebody's earlier choice is worse than a
 * button that does nothing until they unpick one.
 */
export function togglePick(picks: string[], id: string): string[] {
  if (picks.includes(id)) return picks.filter((p) => p !== id)
  return picks.length >= MAX_PRINTERS_PER_REQUEST ? picks : [...picks, id]
}

/** The sticky button on Find a printer. */
export const pickButtonLabel = (n: number) => (n ? `Ask ${plural(n, 'printer')}` : 'Pick a printer to continue')

/** The family's side of a group: "Asked 2 printers." */
export const askedLabel = (groupSize: number) => `Asked ${plural(groupSize, 'printer')}.`

/** The printer's side of the same group: "Also asked 1 other". */
export function othersLabel(groupSize: number): string {
  const others = groupSize - 1
  return others > 0 ? `Also asked ${plural(others, 'other')}` : 'Only you were asked'
}

/** The pill on a printer card, with the Badge tone that colours it. */
export function availability(p: PrinterWithOwner): { label: string; tone: string } {
  if (!p.accepting) return { label: 'Paused', tone: 'withdrawn' }
  if (p.open_jobs >= p.capacity) return { label: 'Full', tone: 'requested' }
  return p.open_jobs ? { label: `${p.open_jobs} in queue`, tone: 'requested' } : { label: 'No queue', tone: 'completed' }
}

/** The five dots of a print job, in order. */
export const RAIL = ['Requested', 'Accepted', 'Printing', 'Ready', 'Collected'] as const

/**
 * Where a job is, in the words the job page and the lists use. `printStep`
 * already reads the timestamps; this adds the two ways a job ends early, which
 * the rail does not have a dot for.
 */
export type JobState = 'asked' | 'accepted' | 'printing' | 'ready' | 'collected' | 'declined' | 'withdrawn'

export function jobState(
  tx: Pick<ToyTransaction, 'status' | 'printing_started_at' | 'ready_at'>
): JobState {
  if (tx.status === 'rejected') return 'declined'
  if (tx.status === 'withdrawn') return 'withdrawn'
  const step = printStep(tx)
  return step === 'closed' ? 'collected' : step
}

/** Which rail dot is current. An ended job stays where it stopped: the first. */
export function railIndex(state: JobState): number {
  const at: Partial<Record<JobState, number>> = { accepted: 1, printing: 2, ready: 3, collected: 4 }
  return at[state] ?? 0
}

export const JOB_LABEL: Record<JobState, string> = {
  asked: 'Requested',
  accepted: 'Accepted',
  printing: 'Printing',
  ready: 'Ready for pickup',
  collected: 'Collected',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
}

/** Badge status keys, so the pill tints match every other status pill. */
export const JOB_TONE: Record<JobState, string> = {
  asked: 'requested',
  accepted: 'accepted',
  printing: 'accepted',
  ready: 'approved',
  collected: 'completed',
  declined: 'rejected',
  withdrawn: 'withdrawn',
}

/** Open jobs sort first — the live one is the one somebody opened the list for. */
export const isLive = (tx: Pick<ToyTransaction, 'status'>) => tx.status === 'requested' || tx.status === 'accepted'

/** "3 h 10", "55 min", "2 h" — the board's form. */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m}`
}

type Part = Pick<PrintJobFile, 'print_minutes' | 'filament_grams' | 'material'> & { quantity?: number }

/** Distinct materials the parts ask for, in the order first seen. */
export const partMaterials = (parts: Part[]) =>
  [...new Set(parts.map((p) => p.material).filter((m): m is NonNullable<typeof m> => !!m))]

/**
 * "about 3 h 10 · ~42 g PETG" over the parts. A figure the guide never gave is
 * left out rather than drawn as 0 — the printer asks in the thread.
 */
export function partsMeta(parts: Part[]): string {
  const sum = (key: 'print_minutes' | 'filament_grams') => {
    const known = parts.filter((p) => p[key] != null)
    return known.length ? known.reduce((n, p) => n + p[key]! * (p.quantity ?? 1), 0) : null
  }
  const minutes = sum('print_minutes')
  const grams = sum('filament_grams')
  const material = partMaterials(parts).join(' + ')
  return [
    minutes !== null ? `about ${formatMinutes(minutes)}` : null,
    grams !== null ? `~${grams} g${material ? ` ${material}` : ''}` : material || null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * Whether one machine can take a job that asks for these materials.
 *
 * A paused or full machine cannot be chosen at all — the accept route refuses
 * it. A missing material can: the board's "Accept anyway", because a leader may
 * know a spool is arriving. Bed size is not checked because no guide stores its
 * parts' dimensions; the bed is the tiebreak in `bestMachine` instead.
 */
export function machineFit(
  p: PrinterWithOwner,
  materials: string[]
): { ok: boolean; blocked: boolean; why: string } {
  if (!p.accepting) return { ok: false, blocked: true, why: 'Paused' }
  if (p.open_jobs >= p.capacity) return { ok: false, blocked: true, why: 'No free slot' }
  const missing = materials.filter((m) => !p.materials.includes(m))
  if (missing.length) return { ok: false, blocked: false, why: `No ${missing.join(' or ')} loaded` }
  return { ok: true, blocked: false, why: `${p.capacity - p.open_jobs} free · ${p.bed_x} mm bed` }
}

/** The machine the picker preselects: fits, then most free slots, then biggest bed. */
export function bestMachine(printers: PrinterWithOwner[], materials: string[]): PrinterWithOwner | undefined {
  const score = (p: PrinterWithOwner) => {
    const fit = machineFit(p, materials)
    return [fit.ok ? 2 : fit.blocked ? 0 : 1, p.capacity - p.open_jobs, p.bed_x]
  }
  return [...printers].sort((a, b) => {
    const [x, y] = [score(a), score(b)]
    return y[0] - x[0] || y[1] - x[1] || y[2] - x[2]
  })[0]
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}

/** The API folds its 4xx sentences into the thrown message; 5xx keeps the fallback. */
export function apiMessage(err: unknown, fallback: string): string {
  const match = /failed with status 4\d\d: (.+)$/.exec(err instanceof Error ? err.message : '')
  return match ? match[1] : fallback
}
