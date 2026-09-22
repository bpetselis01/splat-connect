'use client'
/**
 * The layout every lesson renders inside: the course outline on the left, the
 * lesson on the right, and the way to the next one at the foot.
 *
 * The outline is the one piece of chrome the Learn section has that nothing
 * else does, and it earns it — a nineteen-screen course that a reader works
 * through over several sittings needs to say where they are in it. The rest of
 * the site is one or two levels deep and uses the breadcrumb.
 *
 * The shell owns the lesson's header (crumb, title, lede) as the board does, so
 * every page passes only its body. The lede is the lesson's blurb from
 * lib/learn-course.ts — the same sentence the course home lists it with.
 *
 * Finishing is the primary button — "Done — next: …" — rather than something
 * inferred from scrolling. Scroll-depth would mark a lesson finished for
 * somebody who skimmed it looking for one paragraph, which is the reading
 * somebody does most often. A checkpoint marks itself done on its last answer,
 * so on those the button waits until every question is answered.
 *
 * Related files:
 * - lib/learn-course.ts: the outline
 * - lib/learn-progress.ts: where "done" is kept, and why it is per-device
 */
import Link from 'next/link'
import type { Route } from 'next'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Circle,
  CheckCircle,
  BookOpen,
  Wrench,
  SealCheck,
} from '@phosphor-icons/react/dist/ssr'
import { useLearnProgress } from '@/lib/learn-progress'
import { UNITS, LESSONS, lessonBySlug, unitOf, nextAfter, type LessonKind } from '@/lib/learn-course'

export const KIND_ICON: Record<LessonKind, typeof BookOpen> = {
  read: BookOpen,
  build: Wrench,
  quiz: SealCheck,
}

export function LearnShell({
  slug,
  questions,
  children,
}: {
  slug: string
  /** A checkpoint's question count: the next button waits for every answer. */
  questions?: number
  children: React.ReactNode
}) {
  const { ready, done, answers, markDone } = useLearnProgress()
  const lesson = lessonBySlug(slug)
  const unit = unitOf(slug)
  const next = nextAfter(slug)
  const idx = LESSONS.findIndex((l) => l.slug === slug)
  const prev = idx > 0 ? LESSONS[idx - 1] : undefined

  const finished = ready ? LESSONS.filter((l) => done[l.slug]).length : 0
  const isDone = ready && !!done[slug]
  const quizPending =
    questions !== undefined && (!ready || Object.keys(answers[slug] ?? {}).length < questions)

  const KindIcon = lesson ? KIND_ICON[lesson.kind] : BookOpen

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,284px)_minmax(0,880px)]">
      <aside className="flex flex-col gap-3.5 pr-0.5 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-auto">
        <Link
          href="/learn"
          className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-extrabold text-brand-deep no-underline"
        >
          <ArrowLeft weight="bold" aria-hidden="true" />
          Course home
        </Link>

        <div className="rounded-[var(--radius-inset)] border border-line bg-surface px-[18px] py-4 shadow-[var(--e1)]">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-display text-[15px] font-extrabold text-ink">Switch adapting toys</span>
            {/* Suppressed until storage has been read: rendering "0/16" and then
                correcting it a frame later reads as the course forgetting. */}
            <span className="text-[13px] font-bold text-muted" aria-live="polite">
              {ready ? `${finished}/${LESSONS.length}` : ' '}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={LESSONS.length}
            aria-valuenow={finished}
            aria-label="Course progress"
            className="mt-2.5 h-2 w-full overflow-hidden rounded-pill bg-sunken"
          >
            <div
              className="h-full rounded-pill bg-brand-dark transition-all duration-500"
              style={{ width: `${(finished / LESSONS.length) * 100}%` }}
            />
          </div>
        </div>

        <nav aria-label="Course outline" className="flex flex-col gap-3">
          {UNITS.map((u) => {
            const current = unit?.n === u.n
            return (
              <div key={u.n} className="overflow-hidden rounded-[var(--radius-inset)] border border-line bg-surface">
                {/* The current unit's band takes the unit's own tint, the rest
                    sit back on --surface2 — the same colour the course home
                    gives that unit, so the two screens agree on which is which. */}
                <p
                  className="px-3.5 pb-2 pt-2.5 text-xs font-extrabold uppercase tracking-[0.08em]"
                  style={{
                    background: current ? u.tint : 'var(--surface2)',
                    color: current ? 'var(--tink)' : 'var(--muted)',
                  }}
                >
                  Unit {u.n} · {u.title}
                </p>
                <ul className="flex list-none flex-col">
                  {u.lessons.map((l) => {
                    const Icon = KIND_ICON[l.kind]
                    const here = l.slug === slug
                    return (
                      <li key={l.slug}>
                        <Link
                          // Cast, because typedRoutes cannot narrow a slug that
                          // comes from a data table. lib/learn-course.ts is the
                          // only source of these and every one has a page.
                          href={`/learn/${l.slug}` as Route}
                          aria-current={here ? 'page' : undefined}
                          className={`grid min-h-11 grid-cols-[20px_minmax(0,1fr)_18px] items-center gap-2.5 border-t border-line px-3.5 py-[9px] text-sm leading-[1.3] no-underline transition-colors hover:bg-sunken ${
                            here ? 'bg-brand-50 font-extrabold text-brand-deep' : 'bg-surface font-semibold text-ink'
                          }`}
                        >
                          <Icon size={16} weight="bold" className="opacity-80" aria-hidden="true" />
                          <span className="min-w-0">{l.title}</span>
                          {ready && done[l.slug] ? (
                            <CheckCircle size={18} weight="fill" className="text-success" aria-label="Done" />
                          ) : (
                            <Circle size={18} className="text-line" aria-hidden="true" />
                          )}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </nav>
      </aside>

      {/* A labelled region rather than a bare div: it gives both a screen
          reader and a test a handle that excludes the outline beside it, which
          repeats every lesson title and would otherwise match any assertion
          about the body. */}
      <section aria-label="Lesson" className="min-w-0">
        {unit && lesson && (
          <>
            <p className="inline-flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-[0.08em] text-[var(--amber)]">
              <KindIcon size={16} weight="bold" aria-hidden="true" />
              Unit {unit.n} · {unit.title} · Lesson {unit.lessons.indexOf(lesson) + 1} of{' '}
              {unit.lessons.length} · {lesson.minutes} min
            </p>
            <h1 className="mt-2.5 font-display text-[clamp(32px,3.6vw,46px)] font-extrabold leading-[1.08] tracking-[-0.02em] text-ink [text-wrap:balance]">
              {lesson.title}
            </h1>
            <p className="mt-3.5 max-w-[62ch] text-[19px] leading-[1.6] text-muted [text-wrap:pretty]">
              {lesson.blurb}
            </p>
          </>
        )}

        {/* The board's links are --b700 with no underline until hover. The
            app has no global anchor style, so the lesson body sets it. */}
        <div className="[&_a:not(.btn)]:text-brand-deep [&_a:not(.btn):hover]:underline">{children}</div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-[26px]">
          <div>
            {prev && (
              <Link href={`/learn/${prev.slug}` as Route} className="btn btn-quiet btn-lg no-underline">
                <ArrowLeft weight="bold" aria-hidden="true" />
                {prev.title}
              </Link>
            )}
          </div>
          {quizPending ? (
            <span className="text-sm font-bold text-muted">Answer every question to continue.</span>
          ) : (
            <Link
              href={(next ? `/learn/${next.slug}` : '/learn') as Route}
              onClick={() => markDone(slug)}
              className="btn btn-primary btn-lg no-underline"
            >
              {isDone ? (
                <ArrowRight size={18} weight="bold" aria-hidden="true" />
              ) : (
                <Check size={18} weight="bold" aria-hidden="true" />
              )}
              {isDone
                ? next
                  ? `Next: ${next.title}`
                  : 'Back to the course'
                : next
                  ? `Done — next: ${next.title}`
                  : 'Finish the course'}
            </Link>
          )}
        </div>
      </section>
    </div>
  )
}
