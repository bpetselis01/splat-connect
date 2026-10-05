/**
 * Who a guide or toy suits (127): the board's child questions on the items,
 * and the library filter page's rules for matching them. One module for the
 * API's validation, both editors and both library screens.
 */
import { CHILD_MEASURES, ENJOYS, type ChildMeasureField, type Enjoy } from './index'

/** The board's Movement step: the switch a child can work. */
export const MOVEMENTS = [
  { value: 'press', label: 'Palm or fist press' },
  { value: 'lever', label: 'Lever' },
  { value: 'grasp', label: 'Grasp and hold' },
  { value: 'proximity', label: 'Hand or head near' },
] as const
export type Movement = (typeof MOVEMENTS)[number]['value']

/** The board's Hands step. */
export const HANDS = [
  { value: 'both', label: 'Both hands' },
  { value: 'one', label: 'Mostly one hand' },
  { value: 'left', label: 'Left stronger' },
  { value: 'right', label: 'Right stronger' },
] as const
export type Hand = (typeof HANDS)[number]['value']

export type FitRange = [number, number]
export type Fit = Partial<Record<ChildMeasureField, FitRange>>

/** The four columns 127 adds to tutorials and toys. */
export interface Suits {
  movement?: Movement[] | null
  hands?: Hand[] | null
  play?: Enjoy[] | null
  fit?: Fit | null
}
export const SUITS_FIELDS = ['movement', 'hands', 'play', 'fit'] as const

const values = (list: readonly { value: string }[]) => new Set(list.map((o) => o.value))

/**
 * The suits fields of a request body, checked: each list only from its
 * answers (deduplicated, empty → null), each fit range two whole numbers in
 * CHILD_MEASURES' bounds with min ≤ max. Fields the body leaves out stay out.
 * Returns the sentence a 400 carries when something is not an answer.
 */
export function readSuits(body: Record<string, unknown>): Partial<Suits> | string {
  const out: Partial<Suits> = {}
  const lists: [keyof Suits, readonly { value: string }[], string][] = [
    ['movement', MOVEMENTS, 'movement'],
    ['hands', HANDS, 'hands'],
    ['play', ENJOYS, 'play'],
  ]
  for (const [key, list, word] of lists) {
    if (!(key in body)) continue
    const v = body[key]
    if (v === null) { out[key] = null as never; continue }
    if (!Array.isArray(v) || !v.every((x) => typeof x === 'string' && values(list).has(x))) {
      return `${word} must be a list of: ${list.map((o) => o.value).join(', ')}.`
    }
    const unique = [...new Set(v as string[])]
    out[key] = (unique.length ? unique : null) as never
  }
  if ('fit' in body) {
    const f = body.fit
    if (f === null) out.fit = null
    else if (typeof f !== 'object' || Array.isArray(f)) return 'fit must be an object of measurement ranges.'
    else {
      const fit: Fit = {}
      for (const [k, range] of Object.entries(f as Record<string, unknown>)) {
        const m = CHILD_MEASURES.find((c) => c.field === k)
        if (!m) return `fit takes only ${CHILD_MEASURES.map((c) => c.field).join(', ')}.`
        if (range === null) continue
        const ok = Array.isArray(range) && range.length === 2 && range.every((n) => Number.isInteger(n) && n >= m.min && n <= m.max) && range[0] <= range[1]
        if (!ok) return `${m.label}: a range from ${m.min} to ${m.max}, smallest first.`
        fit[k as ChildMeasureField] = range as FitRange
      }
      out.fit = Object.keys(fit).length ? fit : null
    }
  }
  return out
}

/** What the filter page chose on the suits questions. */
export interface SuitsFilter {
  movement: Movement[]
  hands: Hand[]
  play: Enjoy[]
  fit: Partial<Record<ChildMeasureField, number>>
}
export const NO_SUITS_FILTER: SuitsFilter = { movement: [], hands: [], play: [], fit: {} }

export const suitsFilterCount = (f: SuitsFilter) => f.movement.length + f.hands.length + f.play.length + Object.keys(f.fit).length

/**
 * Whether an item matches: within a question any choice will do, across
 * questions all must hold; a measurement matches a range that contains it.
 * While a question is filtered, an item with no answer to it is left out —
 * "suits" has to mean someone said so.
 */
export function matchesSuits(item: Suits, f: SuitsFilter): boolean {
  const any = <T>(have: T[] | null | undefined, want: T[]) => !want.length || (!!have && want.some((w) => have.includes(w)))
  if (!any(item.movement, f.movement) || !any(item.hands, f.hands) || !any(item.play, f.play)) return false
  for (const [k, n] of Object.entries(f.fit) as [ChildMeasureField, number][]) {
    const r = item.fit?.[k]
    if (!r || n < r[0] || n > r[1]) return false
  }
  return true
}
