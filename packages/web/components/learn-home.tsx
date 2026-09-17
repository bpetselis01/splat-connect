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
  Stack,
  Clock,
  HandHeart,
  ListNumbers,
  Play,
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
              A course in six units, from what a switch actually does to three toys adapted step by
              step and a switch you print yourself. No experience needed, and nothing here assumes
              you own a soldering iron yet. For instructions on one particular toy, head to the{' '}
              <Link href="/library" className="font-bold text-brand-dark hover:underline">
                Guides
              </Link>
              .
            </p>

            <ul className="mt-5 flex list-none flex-wrap gap-2 p-0">
              {[
                { icon: Stack, label: `${UNITS.length} units` },
                { icon: BookOpen, label: `${LESSONS.length} lessons` },
                { icon: Clock, label: `About ${COURSE_HOURS} hours` },
                { icon: HandHeart, label: 'Free · no experience needed' },
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
                className="btn btn-primary no-underline"
              >
                <Play size={18} weight="bold" aria-hidden="true" />
                {finished === 0 ? 'Start the course' : next ? 'Continue' : 'Review the course'}
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
                  {ready && next && finished > 0
                    ? `Next: ${next.title}`
                    : 'Saved on this device.'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-line pt-3.5">
              <div className="flex-none">
                <SplatMascot width={64} />
              </div>
              <p className="learn-hero__bubble">
                {finished === 0
                  ? 'Unit 1 is four short reads. You can do it tonight.'
                  : next
                    ? 'Pick up where you left off — it remembers.'
                    : 'All sixteen done. Go and adapt something.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <h2 id="course-outline" className="mb-3.5 mt-11 scroll-mt-24 font-display text-[26px] font-extrabold text-ink">
        The six units
      </h2>

      <div className="flex flex-col gap-6">
        {UNITS.map((u) => {
          const unitDone = u.lessons.filter((l) => done[l.slug]).length
          return (
            <section key={u.n} className="card p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="eyebrow text-muted">Unit {u.n}</p>
                  <h2 className="mt-0.5 font-display text-xl font-extrabold text-ink">{u.title}</h2>
                  <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted">{u.blurb}</p>
                </div>
                <span className="badge shrink-0 bg-sunken text-muted">
                  {ready && unitDone === u.lessons.length
                    ? 'Complete'
                    : ready && unitDone > 0
                      ? `${unitDone} of ${u.lessons.length} done`
                      : 'Not started'}
                </span>
              </div>

              <ul className="mt-4 flex list-none flex-col gap-1">
                {u.lessons.map((l) => {
                  const Icon = KIND_ICON[l.kind]
                  const isNext = next?.slug === l.slug
                  return (
                    <li key={l.slug}>
                      <Link
                        href={`/learn/${l.slug}` as Route}
                        className={`flex items-start gap-3 rounded-card px-3 py-2.5 transition-colors hover:bg-sunken ${
                          isNext ? 'bg-brand-tint' : ''
                        }`}
                      >
                        {ready && done[l.slug] ? (
                          <Check className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-label="Done" />
                        ) : (
                          <Circle className="mt-0.5 h-5 w-5 shrink-0 text-line" aria-hidden="true" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-ink">{l.title}</span>
                            <span className="inline-flex items-center gap-1 text-xs text-muted">
                              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                              {KIND_LABEL[l.kind]} · {l.minutes} min
                            </span>
                          </span>
                          <span className="mt-0.5 block text-sm leading-relaxed text-muted">
                            {l.blurb}
                          </span>
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
