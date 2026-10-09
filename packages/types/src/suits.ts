/**
 * Who a guide or toy is for (128): the four child questions, asked the same way
 * of a child (onboarding, child editors), a guide or toy (editors) and the
 * library filter page, plus the guide-only Device type. One module for the
 * API's validation, both clients and the seeds — nothing converts between the
 * child's answers and an item's, so "Recommended" is a count of shared answers.
 */
import type { ChildProfile } from './index'

export const PRESS_FORCE = [
  { value: 'very_light', label: 'Very light' },
  { value: 'light', label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'full', label: 'Full' },
] as const
export type PressForce = (typeof PRESS_FORCE)[number]['value']

// 120 — the board's Play step (MB wizard), in its order and words.
export const ENJOYS = [
  { value: 'light', label: 'Lights' },
  { value: 'sound', label: 'Music and sound' },
  { value: 'move', label: 'Things that move' },
  { value: 'soft', label: 'Soft and textured' },
  { value: 'calm', label: 'Calm and sensory' },
  { value: 'water', label: 'Bubbles and water' },
  { value: 'build', label: 'Building and making' },
  { value: 'pretend', label: 'Pretend play' },
] as const
export type Enjoy = (typeof ENJOYS)[number]['value']

/** What a guide is (MMC's Device Type, widened). Guides only. */
export const DEVICE_TYPES = [
  { value: 'adapted_toy', label: 'Adapted toy' },
  { value: 'switch', label: 'Switch' },
  { value: 'switch_interface', label: 'Switch interface' },
  { value: 'mounting', label: 'Mounting and positioning' },
  { value: 'controller', label: 'Joystick, mouse and game controller' },
  { value: 'communication', label: 'Communication (AAC)' },
  { value: 'vision', label: 'Vision' },
  { value: 'hearing', label: 'Hearing' },
  { value: 'sensory', label: 'Sensory and calming' },
  { value: 'learning', label: 'Learning, reading and writing' },
  { value: 'daily_living', label: 'Daily living' },
  { value: 'tablet', label: 'Tablet and device accessory' },
] as const
export type DeviceType = (typeof DEVICE_TYPES)[number]['value']

export const HELPS_WITH = [
  { value: 'moving', label: 'Moving and using hands' },
  { value: 'seeing', label: 'Seeing', hint: 'low vision or blind' },
  { value: 'hearing', label: 'Hearing', hint: 'hard of hearing or Deaf' },
  { value: 'communicating', label: 'Communicating', hint: 'speech or language' },
  { value: 'learning', label: 'Learning and focus' },
  { value: 'calm', label: 'Feeling calm', hint: 'sensory' },
  { value: 'daily', label: 'Eating, dressing and daily tasks' },
] as const
export type HelpsWith = (typeof HELPS_WITH)[number]['value']

export const ACCESS = [
  { value: 'press', label: 'Press', hint: 'palm, fist or finger' },
  { value: 'touch', label: 'Light touch', hint: 'a tap or brush' },
  { value: 'grasp', label: 'Grasp and hold', hint: 'squeeze, pull, twist' },
  { value: 'head', label: 'Head or chin' },
  { value: 'foot', label: 'Foot or knee' },
  { value: 'eyes', label: 'Eyes', hint: 'eye gaze or blink' },
  { value: 'voice', label: 'Voice or breath', hint: 'sound, sip or blow' },
  { value: 'watch', label: 'Watches and listens', hint: 'no action needed' },
] as const
export type Access = (typeof ACCESS)[number]['value']

export const ONE_HAND_LABEL = 'One hand is enough'

/**
 * The four child questions, in the onboarding's order. `child` is the
 * child_profiles column, `item` the tutorials/toys column — the same answers
 * on both sides. Press force is one answer for a child and every press an
 * item works with for a guide or toy.
 */
export const CHILD_QUESTIONS = [
  { child: 'helps_with', item: 'helps_with', label: 'Helps with', prompt: 'What would help your child day to day?', hint: 'Pick any. We use this to put the right guides first, and never share it.', options: HELPS_WITH },
  { child: 'access', item: 'access', label: 'How the child uses it', prompt: 'How does your child start or control things?', hint: 'Pick everything that works, even sometimes.', options: ACCESS },
  { child: 'press_force', item: 'press_force', label: 'Press force', prompt: 'How hard can your child press?', hint: "Skip it if they don't press things.", options: PRESS_FORCE },
  { child: 'enjoys', item: 'play', label: 'Play', prompt: 'What does your child enjoy?', hint: 'Pick any.', options: ENJOYS },
] as const

/** The tag columns 128 puts on tutorials (all six) and toys (all but device_types). */
export interface Suits {
  device_types?: DeviceType[] | null
  helps_with?: HelpsWith[] | null
  access?: Access[] | null
  one_hand?: boolean | null
  press_force?: PressForce[] | null
  play?: Enjoy[] | null
}
export const SUITS_FIELDS = ['helps_with', 'access', 'one_hand', 'press_force', 'play'] as const
export const GUIDE_SUITS_FIELDS = ['device_types', ...SUITS_FIELDS] as const

const LISTS = [
  ['device_types', DEVICE_TYPES],
  ['helps_with', HELPS_WITH],
  ['access', ACCESS],
  ['press_force', PRESS_FORCE],
  ['play', ENJOYS],
] as const

/**
 * The tag fields of a request body, checked: each list only from its answers
 * (deduplicated, empty → null), one_hand a boolean. Only `fields` are read
 * (toys have no device_types); fields the body leaves out stay out. Returns the sentence a 400 carries when something is not an answer.
 */
export function readSuits(body: Record<string, unknown>, fields: readonly string[] = GUIDE_SUITS_FIELDS): Partial<Suits> | string {
  const out: Record<string, unknown> = {}
  for (const [key, list] of LISTS) {
    if (!(key in body) || !fields.includes(key)) continue
    const v = body[key]
    if (v === null) { out[key] = null; continue }
    const allowed = new Set<string>(list.map((o) => o.value))
    if (!Array.isArray(v) || !v.every((x) => typeof x === 'string' && allowed.has(x))) {
      return `${key} must be a list of: ${[...allowed].join(', ')}.`
    }
    const unique = [...new Set(v as string[])]
    out[key] = unique.length ? unique : null
  }
  if ('one_hand' in body) {
    if (body.one_hand !== null && typeof body.one_hand !== 'boolean') return 'one_hand must be true or false.'
    out.one_hand = body.one_hand
  }
  return out as Partial<Suits>
}

/** What the filter page chose. */
export interface SuitsFilter {
  device_types: DeviceType[]
  helps_with: HelpsWith[]
  access: Access[]
  one_hand: boolean
  press_force: PressForce[]
  play: Enjoy[]
}
export const NO_SUITS_FILTER: SuitsFilter = { device_types: [], helps_with: [], access: [], one_hand: false, press_force: [], play: [] }

export const suitsFilterCount = (f: SuitsFilter) =>
  f.device_types.length + f.helps_with.length + f.access.length + (f.one_hand ? 1 : 0) + f.press_force.length + f.play.length

const any = <T>(have: readonly T[] | null | undefined, want: readonly T[]) => !want.length || (!!have && want.some((w) => have.includes(w)))

/**
 * Whether an item matches: within a question any choice will do, across
 * questions all must hold. While a question is filtered, an item with no
 * answer to it is left out — "suits" has to mean someone said so.
 */
export function matchesSuits(item: Suits, f: SuitsFilter): boolean {
  return any(item.device_types, f.device_types) && any(item.helps_with, f.helps_with) && any(item.access, f.access)
    && any(item.press_force, f.press_force) && any(item.play, f.play) && (!f.one_hand || item.one_hand === true)
}

export type ChildTags = Pick<ChildProfile, 'helps_with' | 'access' | 'one_hand' | 'press_force' | 'enjoys'>

const shared = <T>(a: readonly T[] | null | undefined, b: readonly T[] | null | undefined) => (a && b ? a.filter((x) => b.includes(x)).length : 0)

/** How many answers an item shares with a child: the Recommended sort's key. */
export function recommendScore(item: Suits, child: ChildTags): number {
  return shared(item.helps_with, child.helps_with) + shared(item.access, child.access) + shared(item.play, child.enjoys)
    + (item.one_hand && child.one_hand ? 1 : 0) + (child.press_force && item.press_force?.includes(child.press_force) ? 1 : 0)
}

/** Recommended: most shared answers first, then newest. With no child, newest first. */
export function byRecommended<T extends Suits & { created_at: string }>(items: T[], child: ChildTags | null): T[] {
  const score = new Map(items.map((i) => [i, child ? recommendScore(i, child) : 0]))
  return [...items].sort((a, b) => score.get(b)! - score.get(a)! || b.created_at.localeCompare(a.created_at))
}

/** "Suits your child" when the guide shares an answer with any of a parent's children, else null. */
export function fitLine(item: Suits, children: ChildTags[]): string | null {
  return children.some((c) => recommendScore(item, c) > 0) ? 'Suits your child' : null
}

/**
 * The onboarding done screen's count: guides, and live toys, that share an
 * answer with the child. One rule, so the number promised is the list shown.
 */
export function matchesForChild(
  child: ChildTags,
  guides: (Suits & { id: string })[],
  toys: (Suits & { id: string; status: string; paused_at?: string | null })[]
): { guideIds: string[]; toyIds: string[] } {
  return {
    guideIds: guides.filter((g) => recommendScore(g, child) > 0).map((g) => g.id),
    toyIds: toys.filter((t) => t.status === 'published' && !t.paused_at && recommendScore(t, child) > 0).map((t) => t.id),
  }
}
