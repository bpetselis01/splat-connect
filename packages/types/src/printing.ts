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
