/**
 * The print rules the API, web and the phone share — cost, expiry, stats,
 * bed fit, customization, the parts catalogue, verification.
 *
 * No runtime import from ./index: index re-exports this file and imports from
 * it, so a value import back would be a cycle. Type-only imports are fine.
 */

type Grams = { filament_grams?: number | null; quantity?: number }

/**
 * What a family is asked to cover for these parts at one printer's declared
 * rate, in cents: Σ grams × quantity × rate. Null when the rate is null (070:
 * the toggle's off state, "free, parts only"), when any part has no grams,
 * when nothing is ticked or the total is 0 — a line that undercounts is worse than none.
 */
export function printCostCents(files: Grams[], centsPerGram: number | null): number | null {
  if (centsPerGram === null || files.length === 0) return null
  if (files.some((f) => f.filament_grams == null)) return null
  const total = files.reduce((n, f) => n + f.filament_grams! * (f.quantity ?? 1) * centsPerGram, 0)
  return total > 0 ? total : null // a rate of 0 is no estimate, never "$0.00"
}

/** Lowest and highest estimate across the printers picked; null if any has none — no partial range. */
export function costRange(estimates: Array<number | null>): [number, number] | null {
  const known = estimates.filter((e): e is number => e !== null)
  return known.length && known.length === estimates.length ? [Math.min(...known), Math.max(...known)] : null
}

/** Days a printer has to answer a print request (the board's "7 days from today"). */
export const PRINT_ANSWER_DAYS = 7

/** When a request sent at `createdAt` stops waiting for an answer, as an ISO instant. */
export const answerBy = (createdAt: string): string =>
  new Date(Date.parse(createdAt) + PRINT_ANSWER_DAYS * 86_400_000).toISOString()

/**
 * A print request nobody answered in time. Computed on read — no scheduled job
 * flips a status, and `status` keeps its members (058) — so every reader asks
 * this. It owns the type check: lists mix prints with donations and builds.
 */
export function printRequestExpired(
  tx: { status: string; type: string; created_at: string | null },
  now: number = Date.now()
): boolean {
  return (
    tx.type === 'print' && tx.status === 'requested' && !!tx.created_at && now > Date.parse(answerBy(tx.created_at))
  )
}

/** 095's printer_stats / print_job_stats. */
export interface PrinterStats {
  jobs: number
  median_days: number | null
  fitted: number
  fit_answers: number
  colours: string[]
}

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** The find and job cards' "21 jobs · ~3 days". Null below one completed job. */
export function statsLine(s?: PrinterStats | null): string | null {
  if (!s || s.jobs < 1) return null
  return s.median_days === null ? count(s.jobs, 'job') : `${count(s.jobs, 'job')} · ~${count(s.median_days, 'day')}`
}

/** The offer machine picker's lines, in the board's words. */
export function machineStatsLines(s?: PrinterStats | null): string[] {
  if (!s || s.jobs < 1) return []
  return [
    s.median_days === null ? `${s.jobs} completed` : `${s.jobs} completed · median ${count(s.median_days, 'day')}`,
    s.fit_answers ? `${s.fitted} of ${s.fit_answers} fitted first time` : null,
    s.colours.length ? `Colours: ${s.colours.join(', ')}` : null,
  ].filter((l): l is string => l !== null)
}

/** A guide author's "12 of 14 prints fitted". Null until a family has answered. */
export function guideFitLine(s?: Pick<PrinterStats, 'fitted' | 'fit_answers'> | null): string | null {
  return s?.fit_answers ? `${s.fitted} of ${count(s.fit_answers, 'print')} fitted` : null
}

/** Turnaround and Fit on an organisation's profile ("Median 3 days", "29 of 30 first time"). */
export function orgPrintFacts(s?: PrinterStats | null): Array<{ k: string; v: string }> {
  if (!s || s.jobs < 1) return []
  return [
    s.median_days === null ? null : { k: 'Turnaround', v: `Median ${count(s.median_days, 'day')}` },
    s.fit_answers ? { k: 'Fit', v: `${s.fitted} of ${s.fit_answers} first time` } : null,
  ].filter((f): f is { k: string; v: string } => f !== null)
}

/** The board's Customization questions and options, asked per print request (096). */
export const PRINT_FIT_QUESTIONS = [
  { key: 'reach', label: 'Reach from seated', options: ['Under 20 cm', '20–40 cm', 'Over 40 cm'] },
  { key: 'switch_size', label: 'Preferred switch size', options: ['Small (50 mm)', 'Large (100 mm)', 'Extra large'] },
  { key: 'mount', label: 'Mount needed', options: ['Tray clamp', 'Floor stand', 'None'] },
  { key: 'tray', label: 'Tray thickness', options: ['10 mm', '15 mm', '20 mm', 'Not sure'] },
] as const

export type PrintFitKey = (typeof PRINT_FIT_QUESTIONS)[number]['key']
export type PrintFitNotes = Partial<Record<PrintFitKey, string>>

/** Null when every answer is an option its question offers; otherwise the 400's sentence. */
export function fitNotesProblem(v: unknown): string | null {
  const bad = 'Customization answers must be one of the options offered.'
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return bad
  for (const [key, answer] of Object.entries(v)) {
    const q = PRINT_FIT_QUESTIONS.find((x) => x.key === key)
    if (!q || !(q.options as readonly string[]).includes(answer as string)) return bad
  }
  return null
}

/** "Reach from seated: 20–40 cm", in the board's order, for the printer. */
export function fitNotesLines(notes?: PrintFitNotes | null): string[] {
  if (!notes) return []
  return PRINT_FIT_QUESTIONS.filter((q) => notes[q.key]).map((q) => `${q.label}: ${notes[q.key]}`)
}

type Sized = { size_x_mm?: number | null; size_y_mm?: number | null; size_z_mm?: number | null }

/**
 * Whether every part sits on this bed: x/y either way round, z upright (a part
 * is printed the way its author sliced it). True unless every part has all
 * three sizes (097) — the printer still checks before they accept.
 */
export function bedFits(bed: { bed_x: number; bed_y: number; bed_z: number }, parts: Sized[]): boolean {
  if (parts.length === 0 || parts.some((p) => p.size_x_mm == null || p.size_y_mm == null || p.size_z_mm == null)) {
    return true
  }
  return parts.every(
    (p) =>
      p.size_z_mm! <= bed.bed_z &&
      ((p.size_x_mm! <= bed.bed_x && p.size_y_mm! <= bed.bed_y) ||
        (p.size_x_mm! <= bed.bed_y && p.size_y_mm! <= bed.bed_x))
  )
}

/** One row of the printable parts catalogue (GET /api/public/printable-parts) and of Saved parts. */
export interface CataloguePart {
  id: string
  filename: string
  material: string | null
  filament_grams: number | null
  print_minutes: number | null
  tutorial_id: string
  tutorials: { id: string; title: string; status: string }
}

export interface CataloguePage {
  items: CataloguePart[]
  page: number
  pages: number
  total: number
}

/** Completed print jobs a printer needs, beside a passed test print, to be verified (098). */
export const VERIFIED_MIN_JOBS = 3

/** The latest test print on one of the caller's machines (GET /api/printers/mine). */
export interface TestPrint {
  verdict: 'pass' | 'fail' | null
  note: string | null
  submitted_at: string
}

/** Waiting / Passed / Failed — the owner's status line. */
export const testPrintLabel = (t: TestPrint) =>
  t.verdict === 'pass' ? 'Passed' : t.verdict === 'fail' ? 'Failed' : 'Waiting'
