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
 * the toggle's off state, "free, parts only"), when any part has no grams, or
 * when nothing is ticked — a line that undercounts is worse than none.
 */
export function printCostCents(files: Grams[], centsPerGram: number | null): number | null {
  if (centsPerGram === null || files.length === 0) return null
  if (files.some((f) => f.filament_grams == null)) return null
  return files.reduce((n, f) => n + f.filament_grams! * (f.quantity ?? 1) * centsPerGram, 0)
}

/** Lowest and highest estimate across the printers picked; null when none has one. */
export function costRange(estimates: Array<number | null>): [number, number] | null {
  const known = estimates.filter((e): e is number => e !== null)
  return known.length ? [Math.min(...known), Math.max(...known)] : null
}
