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
  CaretRight,
} from '@phosphor-icons/react/dist/ssr'
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

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <p className="eyebrow text-muted">Learn</p>
          <h1 className="mt-1.5 title-hub">Switch adapting toys</h1>
          <p className="mt-2 max-w-prose text-base leading-relaxed text-muted">
            A course in six units, from what a switch actually does to three toys adapted step by
            step and a switch you print yourself. No experience needed, and nothing here assumes
            you own a soldering iron yet.
          </p>

          <dl className="mt-4 flex flex-wrap gap-2">
            {[
              { icon: Stack, label: `${UNITS.length} units` },
              { icon: BookOpen, label: `${LESSONS.length} lessons` },
              { icon: Clock, label: `About ${COURSE_HOURS} hours` },
              { icon: HandHeart, label: 'Free · no experience needed' },
            ].map((m) => (
              <div key={m.label} className="flex items-center gap-1.5 rounded-pill bg-sunken px-3 py-1.5">
                <m.icon className="h-4 w-4 text-brand-dark" aria-hidden="true" />
                <dd className="text-xs font-bold text-ink">{m.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="card w-full p-5 sm:w-64">
          <p className="eyebrow text-muted">Your progress</p>
          <p className="mt-1 font-display text-3xl font-extrabold text-ink" aria-live="polite">
            {ready ? `${finished}/${LESSONS.length}` : '—'}
          </p>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={ready ? pct : 0}
            aria-label="Course progress"
            className="mt-2 h-2 w-full overflow-hidden rounded-pill bg-sunken"
          >
            <div
              className="h-full rounded-pill bg-brand-dark transition-all"
              style={{ width: `${ready ? pct : 0}%` }}
            />
          </div>
          <Link
            href={`/learn/${(next ?? LESSONS[0]).slug}` as Route}
            className="btn btn-primary btn-sm mt-4 w-full"
          >
            {finished === 0 ? 'Start the course' : next ? 'Continue' : 'Review the course'}
            <CaretRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          {ready && next && finished > 0 && (
            <p className="mt-2 text-xs text-muted">Next: {next.title}</p>
          )}
          <p className="mt-2 text-xs text-muted">Saved on this device.</p>
        </div>
      </div>

      <div className="mt-10 flex flex-col gap-6">
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
