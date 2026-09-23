/**
 * The home page's editable copy (site_content, 065) merged over the copy the
 * page ships with. The rows are jsonb an admin wrote through the editor, so
 * every field is checked: a blank or missing one keeps the page's own copy,
 * and nothing saved at all renders the page exactly as it is written.
 */

export const HOME_HERO = {
  eyebrow: 'Free to read, reviewed guides for switch-adapted play',
  headline: 'Press it. Watch it go.',
  subhead:
    'We help families turn ordinary toys into ones that answer to one big switch — so every child gets the part that matters: making something happen.',
  primary_label: 'Find a guide',
  secondary_label: 'Borrow a toy',
}

export type HomeHero = typeof HOME_HERO

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}

export function homeHero(saved: unknown): HomeHero {
  const s = obj(saved)
  const out = { ...HOME_HERO }
  for (const k of Object.keys(HOME_HERO) as Array<keyof HomeHero>) out[k] = text(s[k]) ?? HOME_HERO[k]
  return out
}

/** The hero h1's shape: a break after the first sentence, the last word accented. */
export function heroHeadline(headline: string): { lines: string[]; accent: string } {
  const cut = headline.search(/[.!?]\s/)
  const lines = cut < 0 ? [headline] : [headline.slice(0, cut + 1), headline.slice(cut + 2)]
  const last = lines[lines.length - 1]
  const space = last.lastIndexOf(' ')
  lines[lines.length - 1] = space < 0 ? '' : last.slice(0, space)
  return { lines, accent: space < 0 ? last : last.slice(space + 1) }
}

export const HOME_NUMBER_KEYS = ['guides', 'organisations', 'toys'] as const
export type HomeNumberKey = (typeof HOME_NUMBER_KEYS)[number]

const NUMBER_LABELS: Record<HomeNumberKey, string> = {
  guides: 'guides',
  organisations: 'organisations',
  toys: 'toys delivered',
}

/** A number is counted unless an admin pinned it AND gave it a value. */
export function homeNumbers(
  saved: unknown,
  counted: Record<HomeNumberKey, number>
): Array<{ key: HomeNumberKey; label: string; value: number }> {
  const s = obj(saved)
  return HOME_NUMBER_KEYS.map((key) => {
    const spec = obj(s[key])
    const pinned = spec.live === false && typeof spec.pinned === 'number' ? spec.pinned : null
    return { key, label: text(spec.label) ?? NUMBER_LABELS[key], value: pinned ?? counted[key] }
  })
}

/** Each saved {title, line} is a scene's place and its line, by position. */
export function homeScenes<T extends { place: string; title: string }>(scenes: T[], saved: unknown): T[] {
  const rows = obj(saved).scenes
  if (!Array.isArray(rows)) return scenes
  return scenes.map((scene, i) => {
    const row = obj(rows[i])
    const place = text(row.title)
    const title = text(row.line)
    return place || title ? { ...scene, place: place ?? scene.place, title: title ?? scene.title } : scene
  })
}
