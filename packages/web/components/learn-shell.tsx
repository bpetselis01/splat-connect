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
 * "Mark as done" is a button rather than something inferred from scrolling.
 * Scroll-depth would mark a lesson finished for somebody who skimmed it looking
 * for one paragraph, which is the reading somebody does most often.
 *
 * Related files:
 * - lib/learn-course.ts: the outline
 * - lib/learn-progress.ts: where "done" is kept, and why it is per-device
 */
import Link from 'next/link'
import type { Route } from 'next'
import { CaretLeft, CaretRight, Check, Circle, BookOpen, Wrench, SealCheck } from '@phosphor-icons/react/dist/ssr'
import { useLearnProgress } from '@/lib/learn-progress'
import { UNITS, LESSONS, lessonBySlug, unitOf, nextAfter, type LessonKind } from '@/lib/learn-course'

const KIND_ICON: Record<LessonKind, typeof BookOpen> = {
  read: BookOpen,
  build: Wrench,
  quiz: SealCheck,
}

export function LearnShell({ slug, children }: { slug: string; children: React.ReactNode }) {
  const { ready, done, markDone } = useLearnProgress()
  const lesson = lessonBySlug(slug)
  const unit = unitOf(slug)
  const next = nextAfter(slug)

  const finished = LESSONS.filter((l) => done[l.slug]).length
  const isDone = !!done[slug]

  return (
    <div className="grid gap-8 lg:grid-cols-[17rem_1fr]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Link href="/learn" className="btn btn-quiet btn-sm">
          <CaretLeft className="h-4 w-4" aria-hidden="true" />
          Course home
        </Link>

        <div className="mt-4">
          <p className="font-bold text-ink">Switch adapting toys</p>
          {/* Suppressed until storage has been read: rendering "0/16" and then
              correcting it a frame later reads as the course forgetting. */}
          <p className="text-sm text-muted" aria-live="polite">
            {ready ? `${finished}/${LESSONS.length}` : ' '}
          </p>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={LESSONS.length}
            aria-valuenow={ready ? finished : 0}
            aria-label="Course progress"
            className="mt-2 h-2 w-full overflow-hidden rounded-pill bg-sunken"
          >
            <div
              className="h-full rounded-pill bg-brand-dark transition-all"
              style={{ width: `${ready ? (finished / LESSONS.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        <nav aria-label="Course outline" className="mt-5 flex flex-col gap-4">
          {UNITS.map((u) => (
            // Each unit is a card on the board — white, hairline, 18px, and
            // deliberately no shadow: the outline sits beside the lesson rather
            // than on top of it. Live drew them as bare divs, so the course
            // outline read as one long list instead of five units.
            <div key={u.n} className="card-flat p-3">
              <p className="eyebrow text-muted">
                Unit {u.n} · {u.title}
              </p>
              <ul className="mt-1.5 flex list-none flex-col">
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
                        className={`flex items-center gap-2 rounded-field px-2 py-1.5 text-sm transition-colors ${
                          here ? 'bg-brand-tint font-bold text-brand-deep' : 'text-ink hover:bg-sunken'
                        }`}
                      >
                        {ready && done[l.slug] ? (
                          <Check className="h-4 w-4 shrink-0 text-success" aria-label="Done" />
                        ) : (
                          <Circle className="h-4 w-4 shrink-0 text-line" aria-hidden="true" />
                        )}
                        <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate">{l.title}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* A labelled region rather than a bare div: it gives both a screen
          reader and a test a handle that excludes the outline beside it, which
          repeats every lesson title and would otherwise match any assertion
          about the body. Not an <article> — components/prose-page.tsx already
          is one, and nesting two says the page contains two documents. */}
      <section aria-label="Lesson" className="min-w-0">
        {unit && lesson && (
          <p className="eyebrow text-muted">
            Unit {unit.n} · {unit.title} · {lesson.minutes} min
          </p>
        )}
        {children}

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
          <button
            type="button"
            onClick={() => markDone(slug, !isDone)}
            aria-pressed={isDone}
            className={`btn btn-sm ${isDone ? 'btn-soft' : 'btn-quiet'}`}
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            {isDone ? 'Done' : 'Mark as done'}
          </button>

          {next ? (
            <Link href={`/learn/${next.slug}` as Route} className="btn btn-primary btn-sm">
              Next: {next.title}
              <CaretRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : (
            <Link href="/library" className="btn btn-primary btn-sm">
              Browse the guides
              <CaretRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </div>

        <p className="mt-3 text-xs text-muted">
          {/* The cost of localStorage, said where somebody would notice it. */}
          Progress is kept on this device.
        </p>
      </section>
    </div>
  )
}
