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
 * Related files:
 * - lib/learn-content.json: the build steps and quiz questions, extracted from
 *   the artboard rather than re-authored
 * - components/learn-shell.tsx: the layout every lesson renders inside
 * - lib/learn-progress.ts: which lessons a reader has finished
 */
export type LessonKind = 'read' | 'build' | 'quiz'

export type Lesson = {
  /** The last segment of /learn/<slug>. */
  slug: string
  title: string
  /** Minutes, as the artboard states them. Used for the course's total. */
  minutes: number
  kind: LessonKind
  /** One sentence, shown on the course home. */
  blurb: string
}

export type Unit = {
  n: number
  title: string
  blurb: string
  lessons: Lesson[]
}

export const UNITS: Unit[] = [
  {
    n: 1,
    title: 'Start here',
    blurb:
      'What adapting a toy actually is, how a switch works, which switch suits which child, and which toys to buy.',
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
    n: 2,
    title: 'Set up your bench',
    blurb: 'What to buy once, what to borrow, and how to use it without hurting yourself.',
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
    n: 3,
    title: 'The one skill: a 3.5 mm connector',
    blurb:
      'Every adaptation ends in the same connector. Learn to wire one and you have learned the soldering for the whole course.',
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
    n: 4,
    title: 'Adapt your first toys',
    blurb:
      'Three real toys, photographed step by step. Two go inside the case; one is a plush with a splice.',
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
    n: 5,
    title: 'Make your own switch',
    blurb: 'A 3D-printed button switch with an adjustable feel, for a few dollars in parts.',
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
    n: 6,
    title: 'Hand it over',
    blurb: 'Safety checks, cleaning, and showing a family how to use what you made.',
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

/** Every lesson, in teaching order. */
export const LESSONS: Lesson[] = UNITS.flatMap((u) => u.lessons)

export function lessonBySlug(slug: string): Lesson | undefined {
  return LESSONS.find((l) => l.slug === slug)
}

export function unitOf(slug: string): Unit | undefined {
  return UNITS.find((u) => u.lessons.some((l) => l.slug === slug))
}

/** The lesson after this one, or undefined at the end of the course. */
export function nextAfter(slug: string): Lesson | undefined {
  const i = LESSONS.findIndex((l) => l.slug === slug)
  return i === -1 ? undefined : LESSONS[i + 1]
}

/** Hours, to the nearest half. What the course home advertises. */
export const COURSE_HOURS = Math.round(LESSONS.reduce((n, l) => n + l.minutes, 0) / 30) / 2
