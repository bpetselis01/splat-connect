/**
 * The Learn course: six units, sixteen lessons, in order.
 *
 * One list, read by the course home, every lesson's sidebar, the progress
 * ring and the "next up" button. The artboard's own outline, transcribed from
 * its UNITS/L tables — the order is the teaching, and having it in two places
 * would let the sidebar disagree with the hub about what comes next.
 *
 * Three kinds of lesson, and the distinction is load-bearing rather than
 * decorative: a `read` is prose, a `build` is a numbered procedure with
 * photographs and a materials list, and a `quiz` is a checkpoint that locks
 * nothing. Each gets a different page shape.
 *
 * An admin can rename, re-time, re-kind and reorder it in Site content
 * (`site_content` key `learn-course`); `mergeLearnCourse` lays that over this
 * default. Lessons stay pages in code, so a saved outline never adds one.
 *
 * Related files:
 * - packages/web/components/learn-course-context.tsx: the merged course every
 *   web Learn page reads
 */
export type LessonKind = 'read' | 'build' | 'quiz'

export type LearnLesson = {
  /** The last segment of /learn/<slug>. */
  slug: string
  title: string
  /** Minutes, as the artboard states them. Used for the course's total. */
  minutes: number
  kind: LessonKind
  /** One sentence, shown on the course home. */
  blurb: string
}

export type LearnUnit = {
  /** Stable across reorders and renames: what a saved outline names. */
  id: string
  n: number
  title: string
  blurb: string
  /** The unit's tint on the board: its header band, and its row in an outline. */
  tint: string
  lessons: LearnLesson[]
}

const UNITS: LearnUnit[] = [
  {
    id: 'start-here',
    n: 1,
    title: 'Start here',
    blurb:
      'What adapting a toy actually is, how a switch works, which switch suits which child, and which toys to buy.',
    tint: 'var(--tamber)',
    lessons: [
      {
        slug: 'toy-adaptation-101',
        title: 'Toy adaptation 101',
        minutes: 6,
        kind: 'read',
        blurb:
          'What adapting a toy means, the two ways to do it, and why it is worth an afternoon.',
      },
      {
        slug: 'how-a-switch-works',
        title: 'How a switch works',
        minutes: 5,
        kind: 'read',
        blurb:
          'A button is a gap in a circuit. An adapted toy just gives that gap a second way to close.',
      },
      {
        slug: 'switch-types',
        title: 'Switch types explained',
        minutes: 6,
        kind: 'read',
        blurb:
          'Buttons, levers, proximity and grasp — which suits which child. The right switch is the one a child can operate reliably on a bad day, not their best one.',
      },
      {
        slug: 'choosing-a-toy',
        title: 'Choosing a toy to adapt',
        minutes: 5,
        kind: 'read',
        blurb:
          'What makes a toy easy to adapt, and what makes it impossible. Run a candidate through this before you buy it.',
      },
      {
        slug: 'checkpoint-1',
        title: 'Checkpoint: the basics',
        minutes: 3,
        kind: 'quiz',
        blurb:
          'Three quick questions on Unit 1. Wrong answers explain themselves — that is the point of them.',
      },
    ],
  },
  {
    id: 'bench',
    n: 2,
    title: 'Set up your bench',
    blurb: 'What to buy once, what to borrow, and how to use it without hurting yourself.',
    tint: 'var(--b100)',
    lessons: [
      {
        slug: 'tools-and-materials',
        title: 'Tools and materials',
        minutes: 8,
        kind: 'read',
        blurb:
          'Buy these once and you can adapt any number of toys. Every build lists what is specific to it on top of what is here.',
      },
      {
        // The repo's route is /learn/safety-and-cleaning and predates the
        // artboard's /learn/safe-handling. A rename would break every link
        // already out there for one word; the title is the artboard's.
        slug: 'safety-and-cleaning',
        title: 'Safe handling',
        minutes: 5,
        kind: 'read',
        blurb:
          'Hot irons, lead solder, and small batteries. None of it is dangerous if you follow six habits.',
      },
      {
        slug: 'checkpoint-2',
        title: 'Checkpoint: the bench',
        minutes: 3,
        kind: 'quiz',
        blurb: 'Three questions on tools and safety.',
      },
    ],
  },
  {
    id: 'connector',
    n: 3,
    title: 'The one skill: a 3.5 mm connector',
    blurb:
      'Every adaptation ends in the same connector. Learn to wire one and you have learned the soldering for the whole course.',
    tint: 'var(--tmint)',
    lessons: [
      {
        slug: 'wire-a-connector',
        title: 'Wire a 3.5 mm jack or socket',
        minutes: 25,
        kind: 'build',
        blurb:
          'The connector every adaptation ends in. The steps are the same for a jack (on a switch) and a socket (in a toy).',
      },
      {
        slug: 'checkpoint-3',
        title: 'Checkpoint: the connector',
        minutes: 3,
        kind: 'quiz',
        blurb: 'Three questions on the connector build.',
      },
    ],
  },
  {
    id: 'first-toys',
    n: 4,
    title: 'Adapt your first toys',
    blurb:
      'Three real toys, photographed step by step. Two go inside the case; one is a plush with a splice.',
    tint: 'var(--tcoral)',
    lessons: [
      {
        slug: 'build-hamster-mania',
        title: 'Build 1 · Hamster Mania',
        minutes: 30,
        kind: 'build',
        blurb:
          'A $15 plush hamster that sings and runs. Six triangular screws, one button, one socket.',
      },
      {
        slug: 'build-duck-bubbles',
        title: 'Build 2 · Duck bubble machine',
        minutes: 30,
        kind: 'build',
        blurb:
          'A $12 bubble maker. Same idea as the hamster with one extra move: a knot for strain relief.',
      },
      {
        slug: 'build-ms-rachel',
        title: 'Build 3 · Ms Rachel Speak & Sing',
        minutes: 35,
        kind: 'build',
        blurb:
          'A plush doll with two functions, adapted with a splice instead of a circuit board. Two switches, two cables.',
      },
    ],
  },
  {
    id: 'own-switch',
    n: 5,
    title: 'Make your own switch',
    blurb: 'A 3D-printed button switch with an adjustable feel, for a few dollars in parts.',
    tint: 'var(--tviolet)',
    lessons: [
      {
        slug: 'build-a-switch',
        title: 'Build a 3D-printed switch',
        minutes: 40,
        kind: 'build',
        blurb:
          'Four printed parts, a limit switch, three screws and the jack you learned in Unit 3.',
      },
    ],
  },
  {
    id: 'handover',
    n: 6,
    title: 'Hand it over',
    blurb: 'Safety checks, cleaning, and showing a family how to use what you made.',
    tint: 'var(--tok)',
    lessons: [
      {
        slug: 'handover',
        title: 'Checks, cleaning and handover',
        minutes: 6,
        kind: 'read',
        blurb:
          'Five safety checks, how to clean between families, and what to show the family when you hand it over.',
      },
      {
        slug: 'final-checkpoint',
        title: 'Final checkpoint',
        minutes: 4,
        kind: 'quiz',
        blurb: 'Four questions across the whole course. Pass this and you are ready for the Guides.',
      },
    ],
  },
]

/** "Shown as" in Site content (WB admin_content), in the board's words. */
export const LEARN_SHOWN_AS = [
  { value: 'free', label: 'Free' },
  { value: 'sign_in', label: 'Free, sign-in needed' },
  { value: 'hidden', label: 'Hidden' },
] as const
export type LearnShownAs = (typeof LEARN_SHOWN_AS)[number]['value']

/** A quiz is shown as a checkpoint everywhere; the stored value stays `quiz`. */
export const LESSON_KIND_LABEL: Record<LessonKind, string> = { read: 'Read', build: 'Build', quiz: 'Checkpoint' }

/**
 * The course as every page reads it. The title, outcome and "Shown as" exist
 * only once an admin saves them: null title or outcome means "the page's own
 * words". `n` is the unit's position, so "Unit 1" is whichever comes first.
 */
export type LearnCourse = {
  title: string | null
  outcome: string | null
  shown_as: LearnShownAs
  units: LearnUnit[]
}

export const LEARN_COURSE: LearnCourse = { title: null, outcome: null, shown_as: 'free', units: UNITS }

/** What Site content saves under `learn-course`, after readLearnCourse. */
export type LearnCourseSaved = {
  title?: string
  outcome?: string
  shown_as?: LearnShownAs
  units?: {
    id: string
    title: string
    blurb: string
    lessons: { slug: string; title: string; minutes: number; kind: LessonKind }[]
  }[]
}

/** Every lesson, in teaching order. */
export const learnLessons = (c: LearnCourse): LearnLesson[] => c.units.flatMap((u) => u.lessons)

export const lessonBySlug = (c: LearnCourse, slug: string): LearnLesson | undefined =>
  learnLessons(c).find((l) => l.slug === slug)

export const unitOf = (c: LearnCourse, slug: string): LearnUnit | undefined =>
  c.units.find((u) => u.lessons.some((l) => l.slug === slug))

/** The lesson after this one, or undefined at the end of the course. */
export function nextAfter(c: LearnCourse, slug: string): LearnLesson | undefined {
  const all = learnLessons(c)
  const i = all.findIndex((l) => l.slug === slug)
  return i === -1 ? undefined : all[i + 1]
}

/** Hours, to the nearest half. What the course home advertises. */
export const courseHours = (c: LearnCourse): number =>
  Math.round(learnLessons(c).reduce((n, l) => n + l.minutes, 0) / 30) / 2

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const trimmed = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const KINDS: readonly string[] = ['read', 'build', 'quiz']
const SHOWN: readonly string[] = LEARN_SHOWN_AS.map((o) => o.value)

/**
 * The admin PUT's check for `learn-course` (Global Constraints' limits). The
 * first problem, as a sentence an admin can act on, or the value trimmed.
 * Slugs and unit ids are not checked against the course: mergeLearnCourse
 * ignores what the code does not have, so a lesson renamed in code never
 * makes an old saved value unsaveable.
 */
export function readLearnCourse(v: unknown): { value: LearnCourseSaved } | { error: string } {
  if (!isObj(v)) return { error: 'Send the course as an object.' }
  const out: LearnCourseSaved = {}
  if (v.title !== undefined) {
    const t = trimmed(v.title)
    if (t.length < 1 || t.length > 80) return { error: 'The course title must be 1 to 80 characters.' }
    out.title = t
  }
  if (v.outcome !== undefined) {
    if (typeof v.outcome !== 'string' || v.outcome.trim().length > 400) {
      return { error: 'What a reader can do by the end must be 400 characters or fewer.' }
    }
    out.outcome = v.outcome.trim()
  }
  if (v.shown_as !== undefined) {
    if (!SHOWN.includes(v.shown_as as string)) return { error: 'Shown as must be free, sign_in or hidden.' }
    out.shown_as = v.shown_as as LearnShownAs
  }
  if (v.units !== undefined) {
    if (!Array.isArray(v.units)) return { error: 'Units must be a list.' }
    out.units = []
    for (const u of v.units) {
      if (!isObj(u) || typeof u.id !== 'string') return { error: 'Each unit needs its id.' }
      const title = trimmed(u.title)
      if (title.length < 1 || title.length > 80) return { error: 'A unit title must be 1 to 80 characters.' }
      const blurb = trimmed(u.blurb)
      if (blurb.length > 300) return { error: 'A unit blurb must be 300 characters or fewer.' }
      if (!Array.isArray(u.lessons)) return { error: 'Each unit needs its lessons as a list.' }
      const lessons: NonNullable<LearnCourseSaved['units']>[number]['lessons'] = []
      for (const l of u.lessons) {
        if (!isObj(l) || typeof l.slug !== 'string') return { error: 'Each lesson needs its slug.' }
        const lt = trimmed(l.title)
        if (lt.length < 1 || lt.length > 80) return { error: 'A lesson title must be 1 to 80 characters.' }
        const m = l.minutes
        if (typeof m !== 'number' || !Number.isInteger(m) || m < 1 || m > 240) {
          return { error: 'A lesson length must be a whole number of minutes from 1 to 240.' }
        }
        if (!KINDS.includes(l.kind as string)) return { error: 'A lesson is a read, a build or a checkpoint.' }
        lessons.push({ slug: l.slug, title: lt, minutes: m, kind: l.kind as LessonKind })
      }
      out.units.push({ id: u.id, title, blurb, lessons })
    }
  }
  return { value: out }
}

/**
 * A saved outline laid over the code's (Review Focus 5). Units come in the
 * saved order; units it leaves out follow in default order. Within a unit,
 * lessons come in the saved order with their saved title, minutes and kind;
 * a slug the unit does not have — unknown, or another unit's — is ignored, so
 * a lesson never changes unit; lessons left out follow in default order.
 * Anything readLearnCourse refuses is the default, whole.
 */
export function mergeLearnCourse(saved: unknown): LearnCourse {
  const read = readLearnCourse(saved)
  if ('error' in read) return LEARN_COURSE
  const s = read.value
  const byId = new Map(UNITS.map((u) => [u.id, u]))
  const seen = new Set<string>()
  const ordered: LearnUnit[] = []
  for (const su of s.units ?? []) {
    const base = byId.get(su.id)
    if (!base || seen.has(su.id)) continue
    seen.add(su.id)
    const own = new Map(base.lessons.map((l) => [l.slug, l]))
    const used = new Set<string>()
    const lessons: LearnLesson[] = []
    for (const sl of su.lessons) {
      const b = own.get(sl.slug)
      if (!b || used.has(sl.slug)) continue
      used.add(sl.slug)
      lessons.push({ ...b, title: sl.title, minutes: sl.minutes, kind: sl.kind })
    }
    lessons.push(...base.lessons.filter((l) => !used.has(l.slug)))
    ordered.push({ ...base, title: su.title, blurb: su.blurb || base.blurb, lessons })
  }
  ordered.push(...UNITS.filter((u) => !seen.has(u.id)))
  return {
    title: s.title ?? null,
    outcome: s.outcome || null,
    shown_as: s.shown_as ?? 'free',
    units: ordered.map((u, i) => ({ ...u, n: i + 1 })),
  }
}
