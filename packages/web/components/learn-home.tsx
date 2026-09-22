'use client'
/**
 * The course home: what the course is, how far through you are, and the six
 * units laid out in order.
 *
 * The continue button is the whole point of the screen. Somebody coming back on
 * a second evening wants one control that says where they left off, not a grid
 * of nineteen links to scan — so the next unfinished lesson is named on it.
 *
 * Progress is per device and the page says so. See lib/learn-progress.ts for
 * why that is the right trade rather than an omission.
 */
import Link from 'next/link'
import type { Route } from 'next'
import {
  BookOpen,
  Wrench,
  SealCheck,
  Check,
  Circle,
  CheckCircle,
  Stack,
  Clock,
  HandHeart,
  ListNumbers,
  Play,
  PlugsConnected,
  ShoppingCart,
} from '@phosphor-icons/react/dist/ssr'
import { SplatMascot } from '@/components/splat-mascot'
import { useLearnProgress } from '@/lib/learn-progress'
import { UNITS, LESSONS, COURSE_HOURS, type LessonKind } from '@/lib/learn-course'

const KIND_ICON: Record<LessonKind, typeof BookOpen> = {
  read: BookOpen,
  build: Wrench,
  quiz: SealCheck,
}
const KIND_LABEL: Record<LessonKind, string> = { read: 'Read', build: 'Build', quiz: 'Checkpoint' }
// Each kind keeps one colour everywhere it appears: the legend, and every row.
const KIND_COLOR: Record<LessonKind, string> = {
  read: 'var(--b600)',
  build: 'var(--coral)',
  quiz: 'var(--mint)',
}

const OUTCOMES = [
  {
    icon: PlugsConnected,
    t: 'Explain the trick',
    d: 'Say in one sentence why an external switch works, and which of the two routes a given toy needs.',
    tint: 'var(--tamber)',
  },
  {
    icon: ShoppingCart,
    t: 'Buy the right toy',
    d: 'Walk a shop aisle and pick a toy that will adapt in twenty minutes, not one that fights you.',
    tint: 'var(--b100)',
  },
  {
    icon: Wrench,
    t: 'Solder a connector',
    d: 'Wire a 3.5 mm jack or socket cleanly, insulate it, and prove it works with a multimeter.',
    tint: 'var(--tmint)',
  },
  {
    icon: HandHeart,
    t: 'Hand over safely',
    d: 'Run the five checks, clean it, and show a family how to use what you made.',
    tint: 'var(--tok)',
  },
]

export function LearnHome() {
  const { ready, done } = useLearnProgress()
  const finished = LESSONS.filter((l) => done[l.slug]).length
  const next = LESSONS.find((l) => !done[l.slug])
  const pct = Math.round((finished / LESSONS.length) * 100)

  // The ring is r=34 in an 80-unit box, so its circumference is what the dash
  // array has to be expressed in. Computed rather than written down: a literal
  // 213.6 here is a number nobody can check against the radius above it.
  const R = 34
  const circumference = 2 * Math.PI * R

  return (
    <div>
      {/* The board's course hero: a card, not a heading over a sidebar. The two
          drifting blobs behind it are the only decoration on the screen, and
          they are what stops a 54px headline sitting on bare paper. */}
      <div className="learn-hero">
        <div aria-hidden="true" className="learn-hero__blobs">
          <span />
          <span />
        </div>

        <div className="learn-hero__grid">
          <div className="min-w-0">
            <p className="eyebrow text-muted">Learn · A free course</p>
            <h1 className="learn-hero__title">
              Switch adapting toys, from first switch to handover.
            </h1>
            <p className="mt-4 max-w-[54ch] text-lg leading-[1.6] text-muted [text-wrap:pretty]">
              Six short units. You will learn what a switch does, set up a bench without wasting
              money, master the one soldering job every adaptation needs, then adapt three real toys
              and build a switch of your own. For instructions on one particular toy, head to the{' '}
              <Link href="/library" className="text-brand-deep hover:underline">
                Guides
              </Link>
              .
            </p>

            <ul className="mt-5 flex list-none flex-wrap gap-2 p-0">
              {[
                { icon: Stack, label: `${UNITS.length} units` },
                { icon: BookOpen, label: `${LESSONS.length} lessons` },
                { icon: Clock, label: `About ${COURSE_HOURS} hours` },
                { icon: HandHeart, label: 'Free to attend · no experience needed' },
              ].map((m) => (
                <li key={m.label} className="course-meta">
                  <m.icon size={16} weight="bold" className="text-brand-dark" aria-hidden="true" />
                  {m.label}
                </li>
              ))}
            </ul>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`/learn/${(next ?? LESSONS[0]).slug}` as Route}
                className="btn btn-primary btn-lg no-underline"
              >
                <Play size={18} weight="bold" aria-hidden="true" />
                {finished === 0
                  ? 'Start the course'
                  : next
                    ? `Continue: ${next.title}`
                    : 'Review the course'}
              </Link>
              <a href="#course-outline" className="btn btn-quiet btn-lg no-underline">
                <ListNumbers size={19} weight="bold" className="text-apricot" aria-hidden="true" />
                See the outline
              </a>
            </div>
          </div>

          <div className="learn-progress">
            <div className="flex items-center gap-5">
              <div className="relative h-24 w-24 flex-none">
                <svg
                  viewBox="0 0 80 80"
                  width="96"
                  height="96"
                  aria-hidden="true"
                  className="-rotate-90"
                >
                  <circle cx="40" cy="40" r={R} fill="none" stroke="var(--surface2)" strokeWidth="9" />
                  {/* Omitted entirely at zero rather than drawn with a zero
                      dash: a round linecap on a zero-length dash paints a dot
                      at twelve o'clock, so an untouched course looked one
                      lesson in. */}
                  {ready && pct > 0 && (
                    <circle
                      cx="40"
                      cy="40"
                      r={R}
                      fill="none"
                      stroke="var(--b600)"
                      strokeWidth="9"
                      strokeLinecap="round"
                      strokeDasharray={`${(circumference * pct) / 100} ${circumference}`}
                      className="transition-[stroke-dasharray] duration-500"
                    />
                  )}
                </svg>
                <span className="absolute inset-0 grid place-items-center">
                  <span className="font-display text-[22px] font-extrabold tracking-[-0.02em] text-ink">
                    {ready ? pct : 0}%
                  </span>
                </span>
              </div>
              <div className="min-w-0">
                <span className="eyebrow block text-muted">Your progress</span>
                <span
                  className="mt-1 block font-display text-[22px] font-extrabold leading-[1.15] text-ink"
                  aria-live="polite"
                >
                  {ready ? finished : 0} of {LESSONS.length} lessons
                </span>
                <span className="mt-1 block text-sm leading-[1.45] text-muted">
                  {/* Not the board's "Sign in to keep it across devices": progress
                      is per device whether or not somebody is signed in (see
                      lib/learn-progress.ts), so that would be a promise. */}
                  Saved on this device.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-line pt-3.5">
              <div className="flex-none">
                <SplatMascot width={72} pose={next ? 'think' : 'party'} />
              </div>
              <p className="learn-hero__bubble">
                {finished === 0
                  ? 'Unit 1 is four short reads. Start there.'
                  : next
                    ? `Next up: ${next.title}.`
                    : 'You finished. Go find a guide for a toy you own.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <h2 className="mb-3.5 mt-11 font-display text-[26px] font-extrabold text-ink">
        What you will be able to do
      </h2>
      <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
        {OUTCOMES.map((o) => (
          <li
            key={o.t}
            className="min-w-0 rounded-card border border-line px-5 pb-[22px] pt-5 text-[var(--tink)]"
            style={{ background: o.tint }}
          >
            <o.icon size={32} weight="duotone" aria-hidden="true" />
            <h3 className="mb-1.5 mt-3 font-display text-lg font-extrabold leading-[1.2]">{o.t}</h3>
            <p className="text-sm leading-normal opacity-85">{o.d}</p>
          </li>
        ))}
      </ul>

      <div
        id="course-outline"
        className="mb-[18px] mt-12 flex scroll-mt-24 flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h2 className="font-display text-[26px] font-extrabold text-ink">The course, unit by unit</h2>
          <p className="mt-1 text-sm text-muted">
            In order is best. Nothing is locked — skip ahead if you already know it.
          </p>
        </div>
        <span className="inline-flex items-center gap-3.5 text-[13px] font-bold text-muted">
          {(['read', 'build', 'quiz'] as const).map((k) => {
            const Icon = KIND_ICON[k]
            return (
              <span key={k} className="inline-flex items-center gap-1.5">
                <Icon weight="bold" style={{ color: KIND_COLOR[k] }} aria-hidden="true" />
                {KIND_LABEL[k]}
              </span>
            )
          })}
        </span>
      </div>

      {/* A path, not a stack of cards: each unit hangs off a numbered node,
          and the line between nodes turns green as units are finished. */}
      <ol className="flex list-none flex-col p-0">
        {UNITS.map((u, i) => {
          const unitDone = ready ? u.lessons.filter((l) => done[l.slug]).length : 0
          const status =
            unitDone === u.lessons.length
              ? 'done'
              : unitDone > 0 || u.lessons.some((l) => l.slug === next?.slug)
                ? 'current'
                : 'todo'
          const mins = u.lessons.reduce((n, l) => n + l.minutes, 0)
          return (
            <li key={u.n} className="grid grid-cols-[56px_minmax(0,1fr)] gap-4">
              <div className="flex flex-col items-center">
                <span
                  aria-hidden="true"
                  className="grid h-12 w-12 flex-none place-items-center rounded-full border border-line font-display text-[19px] font-extrabold shadow-[var(--e1)]"
                  style={{
                    background:
                      status === 'done' ? 'var(--ok)' : status === 'current' ? 'var(--b600)' : 'var(--surface)',
                    color: status === 'todo' ? 'var(--muted)' : 'var(--onbrand)',
                  }}
                >
                  {status === 'done' ? <Check size={22} weight="bold" /> : u.n}
                </span>
                {i < UNITS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="my-1.5 w-1 flex-1 rounded-sm"
                    style={{ background: status === 'done' ? 'var(--ok)' : 'var(--line)' }}
                  />
                )}
              </div>

              <section className="mb-[22px] overflow-hidden rounded-card border border-line bg-surface shadow-[var(--e2),var(--hi)]">
                <div
                  className="flex items-start justify-between gap-4 px-[22px] pb-4 pt-5 text-[var(--tink)]"
                  style={{ background: u.tint }}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold uppercase leading-6 tracking-[0.1em] opacity-75">
                      Unit {u.n} · {u.lessons.length} {u.lessons.length === 1 ? 'lesson' : 'lessons'} · {mins} min
                    </p>
                    <h3 className="my-1 font-display text-[23px] font-extrabold leading-[1.15]">{u.title}</h3>
                    <p className="max-w-[60ch] text-[15px] leading-normal opacity-85">{u.blurb}</p>
                  </div>
                  <span
                    className="flex-none rounded-pill px-3 py-1.5 text-xs font-extrabold shadow-[var(--e1)]"
                    style={{
                      background: status === 'done' ? 'var(--ok)' : 'var(--surface)',
                      color: status === 'done' ? 'var(--onbrand)' : 'var(--ink)',
                    }}
                  >
                    {status === 'done'
                      ? 'Complete'
                      : status === 'current'
                        ? `${unitDone} of ${u.lessons.length} done`
                        : 'Not started'}
                  </span>
                </div>

                <ul className="flex list-none flex-col p-0">
                  {u.lessons.map((l) => {
                    const Icon = KIND_ICON[l.kind]
                    const isNext = next?.slug === l.slug
                    return (
                      <li key={l.slug}>
                        <Link
                          href={`/learn/${l.slug}` as Route}
                          className={`grid min-h-14 grid-cols-[32px_minmax(0,1fr)_auto_28px] items-center gap-3.5 border-t border-line px-[22px] py-[13px] text-ink no-underline transition-colors hover:bg-sunken ${
                            isNext ? 'bg-brand-50' : ''
                          }`}
                        >
                          <Icon size={20} weight="bold" style={{ color: KIND_COLOR[l.kind] }} aria-hidden="true" />
                          <span className="min-w-0">
                            <span className="block text-base font-extrabold">{l.title}</span>
                            <span className="mt-px block text-[13px] text-muted">
                              {KIND_LABEL[l.kind]} · {l.minutes} min
                            </span>
                          </span>
                          {/* No placeholder when absent, as on the board: the
                              status ring then takes the auto column and sits
                              one track in from the edge on every row but the
                              next one. */}
                          {isNext && (
                            <span className="rounded-pill bg-brand-dark px-2.5 py-1 text-[11px] font-extrabold tracking-[0.06em] text-white">
                              UP NEXT
                            </span>
                          )}
                          {ready && done[l.slug] ? (
                            <CheckCircle size={24} weight="fill" className="justify-self-end text-success" aria-label="Done" />
                          ) : (
                            <Circle size={24} className="justify-self-end text-line" aria-hidden="true" />
                          )}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </section>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
