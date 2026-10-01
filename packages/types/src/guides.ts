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

/** 088. A guide's own print settings; every one optional. */
export type PrintSettings = {
  layer_height_mm?: number | null
  infill_percent?: number | null
  material?: string | null
  print_minutes?: number | null
}

/** "40 min", "2 h", "3 h 10" — the board's print times. */
export function formatPrintMinutes(m: number): string {
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} h ${r}` : `${h} h`
}

export function printSettingRows(t: PrintSettings): { k: string; v: string }[] {
  const rows: { k: string; v: string }[] = []
  if (t.layer_height_mm != null) rows.push({ k: 'Layer height', v: `${Number(t.layer_height_mm)} mm` })
  if (t.infill_percent != null) rows.push({ k: 'Infill', v: `${t.infill_percent} %` })
  if (t.material) rows.push({ k: 'Material', v: t.material })
  if (t.print_minutes != null) rows.push({ k: 'Print time', v: formatPrintMinutes(t.print_minutes) })
  return rows
}

/** "0.2 mm · 25 % · PETG": what a printer sets, without the time. */
export const printSettingsLine = (t: PrintSettings) =>
  printSettingRows(t).filter((r) => r.k !== 'Print time').map((r) => r.v).join(' · ')
