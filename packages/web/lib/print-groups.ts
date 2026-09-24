/**
 * The web side of a print request sent to several printers (074): the family
 * picks up to three, the first to accept takes it, and an organisation with
 * more than one machine picks which bench the job lands on.
 *
 * Pure, so the server pages and the client cards can both import it (see the
 * note in printer-availability.ts about 'use client' modules).
 */
import { MAX_PRINTERS_PER_REQUEST } from '@splat-connect/types'
import type { PrintJobFile, PrinterWithOwner } from '@splat-connect/types'

/** Tick or untick a printer. A fourth pick is refused rather than swapped in. */
export function togglePrinterPick(picked: string[], id: string): string[] {
  if (picked.includes(id)) return picked.filter((p) => p !== id)
  return picked.length >= MAX_PRINTERS_PER_REQUEST ? picked : [...picked, id]
}

/** The board's tray line under the printer list. */
export function pickSummary(count: number): string {
  return count === 0
    ? 'Pick up to three printers'
    : `${count} of ${MAX_PRINTERS_PER_REQUEST} picked · first to accept wins`
}

/** "Asked 3 printers" — the family's side, while nobody has said yes. */
export function askedPrintersLabel(size: number | null | undefined): string | null {
  return size && size > 1 ? `Asked ${size} printers` : null
}

/** The printer's side, in the board's words. Null when they were the only one. */
export function othersAskedLabel(size: number | null | undefined): string | null {
  if (!size || size < 2) return null
  const others = size - 1
  return `${others} other printer${others === 1 ? ' was' : 's were'} asked — first to accept wins`
}

export type MachineFit = { printer: PrinterWithOwner; ok: boolean; why: string[] }

/**
 * Whether one of an organisation's machines can take this job: it holds every
 * material the guide's parts name, it is taking jobs, and it has a free slot.
 * Bed size is not checked — an STL row stores no dimensions to check it with.
 */
function machineFit(printer: PrinterWithOwner, files: PrintJobFile[]): MachineFit {
  const why: string[] = []
  const needed = [...new Set(files.map((f) => f.material).filter((m): m is NonNullable<typeof m> => !!m))]
  const missing = needed.filter((m) => !printer.materials.includes(m))
  if (missing.length) why.push(`No ${missing.join(' or ')} listed`)
  if (!printer.accepting) why.push('Not taking jobs')
  else if (printer.open_jobs >= printer.capacity) why.push('No free slot')
  return { printer, ok: why.length === 0, why }
}

/**
 * Every machine fit-checked, best first: those that fit, then fewest problems,
 * then most free slots. The first is the one the accept button preselects.
 */
export function rankMachines(printers: PrinterWithOwner[], files: PrintJobFile[]): MachineFit[] {
  const free = (p: PrinterWithOwner) => p.capacity - p.open_jobs
  return printers
    .map((p) => machineFit(p, files))
    .sort((a, b) => a.why.length - b.why.length || free(b.printer) - free(a.printer))
}
