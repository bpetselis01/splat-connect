/**
 * The pure rules behind a guide's detail and editors, shared by web, mobile
 * and the API (docs/superpowers/specs/2026-10-01-guides-build-design.md).
 */

/** How a family gets a tool (085), in the board's words. */
export const TOOL_GET_BY_LABEL = { buy: 'Buy once', borrow: 'Borrow', substitute: 'Substitute' } as const
export type ToolGetBy = keyof typeof TOOL_GET_BY_LABEL

/**
 * The parts total, or null when it must not show: a total that leaves out a
 * required part is a number a parent plans an evening around and is wrong.
 * Optional parts are never in it.
 */
export function partsTotalCents(parts: readonly { is_optional: boolean; price_cents?: number | null }[]): number | null {
  const required = parts.filter((p) => !p.is_optional)
  if (!required.length || required.some((p) => p.price_cents == null)) return null
  return required.reduce((sum, p) => sum + (p.price_cents as number), 0)
}

/** A `date` column ('2026-08-02') as the board writes it: "2 Aug 2026". UTC
 *  because the column has no time, and local midnight can fall the day before. */
export function checkedOn(date: string): string {
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
}

/**
 * Captions after the photos moved: each follows its URL, a new photo has
 * none, trailing nulls are trimmed so the list never outgrows the photos.
 */
export function realignCaptions(
  beforeUrls: readonly string[],
  beforeCaptions: readonly (string | null)[],
  afterUrls: readonly string[]
): (string | null)[] {
  const byUrl = new Map(beforeUrls.map((url, i) => [url, beforeCaptions[i] ?? null]))
  const out = afterUrls.map((url) => byUrl.get(url) ?? null)
  while (out.length && out[out.length - 1] == null) out.pop()
  return out
}
