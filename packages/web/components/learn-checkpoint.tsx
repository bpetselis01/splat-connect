'use client'
/**
 * A checkpoint: three or four questions, answered one at a time, with instant
 * feedback.
 *
 * Nothing is locked behind it and the page says so. A course that gated Unit 4
 * on a quiz would turn a wrong answer into a wall, and the person most likely
 * to hit that wall is the one who most needs the next unit. The artboard is
 * explicit: "Nothing is locked behind it."
 *
 * Wrong answers explain themselves, which is the whole reason the quiz exists.
 * The explanation shows on the RIGHT answer too — it is the sentence somebody
 * would want at the bench, and a reader who guessed correctly has learned
 * nothing from being told they were right.
 *
 * Answers are kept per device alongside lesson progress, so coming back to a
 * finished checkpoint shows what was answered rather than a blank form.
 */
import { Check, X, ArrowCounterClockwise } from '@phosphor-icons/react/dist/ssr'
import { useLearnProgress } from '@/lib/learn-progress'

export type Question = {
  q: string
  opts: string[]
  /** Index of the right option. */
  a: number
  why: string
}

export function LearnCheckpoint({
  slug,
  title,
  questions,
  final,
}: {
  slug: string
  title: string
  questions: Question[]
  /** The last checkpoint says something different when it is finished. */
  final?: boolean
}) {
  const { ready, answers, recordAnswer, resetQuiz, markDone } = useLearnProgress()
  const given = answers[slug] ?? {}
  const answered = questions.filter((_, i) => given[i] !== undefined).length
  const allAnswered = answered === questions.length
  const score = questions.filter((q, i) => given[i] === q.a).length
  const perfect = score === questions.length

  function pick(i: number, option: number) {
    recordAnswer(slug, i, option)
    // The last answer finishes the lesson. A checkpoint you answered is a
    // checkpoint you did, whatever the score — it locks nothing either way.
    if (Object.keys({ ...given, [i]: option }).length === questions.length) markDone(slug)
  }

  return (
    <div>
      <h1 className="mt-1.5 title-article">{title}</h1>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
        {questions.length} question{questions.length === 1 ? '' : 's'}. Wrong answers explain
        themselves — that is the point of them. Nothing is locked behind this.
      </p>

      <ol className="mt-6 flex list-none flex-col gap-6">
        {questions.map((q, i) => {
          const chosen = given[i]
          const shown = ready && chosen !== undefined
          return (
            <li key={q.q} className="card p-5">
              <p className="eyebrow text-muted">
                Question {i + 1} of {questions.length}
              </p>
              <p className="mt-1 font-bold text-ink">{q.q}</p>

              <div
                role="radiogroup"
                aria-label={q.q}
                className="mt-3 flex flex-col gap-2"
              >
                {q.opts.map((opt, oi) => {
                  const isChosen = chosen === oi
                  const isRight = oi === q.a
                  // Once answered, the right one is marked whether or not it
                  // was picked — the reader needs to see which it was.
                  const tone = !shown
                    ? 'border-line bg-surface'
                    : isRight
                      ? 'border-success bg-success-soft'
                      : isChosen
                        ? 'border-danger bg-danger-soft'
                        : 'border-line bg-surface opacity-70'
                  return (
                    <label
                      key={opt}
                      className={`flex cursor-pointer items-start gap-3 rounded-card border p-3 text-sm ${tone}`}
                    >
                      <input
                        type="radio"
                        name={`${slug}-${i}`}
                        checked={isChosen}
                        onChange={() => pick(i, oi)}
                        className="mt-0.5"
                      />
                      <span className="flex-1 text-ink">{opt}</span>
                      {shown && isRight && (
                        <Check className="h-4 w-4 shrink-0 text-success" aria-label="Correct" />
                      )}
                      {shown && isChosen && !isRight && (
                        <X className="h-4 w-4 shrink-0 text-danger" aria-label="Not this one" />
                      )}
                    </label>
                  )
                })}
              </div>

              {shown && (
                <p className="mt-3 rounded-card bg-sunken px-4 py-3 text-sm leading-relaxed text-ink">
                  {q.why}
                </p>
              )}
            </li>
          )
        })}
      </ol>

      {ready && allAnswered && (
        <div className="card mt-8 p-6">
          <p className="eyebrow text-muted">{final ? 'Course complete' : 'Checkpoint done'}</p>
          <p className="mt-1 font-display text-2xl font-extrabold text-ink">
            {final
              ? perfect
                ? 'You know this. Go build.'
                : 'You finished the course.'
              : perfect
                ? `All ${questions.length} right.`
                : `${score} of ${questions.length} right.`}
          </p>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
            {final
              ? 'Everything from here is practice. The Guides have step-by-step instructions for dozens of toys, and Makers wanted has families waiting for exactly what you can now make.'
              : perfect
                ? 'Nothing to revise. On to the next unit.'
                : 'Read the explanations above — each one is the sentence you would want to remember at the bench. Nothing is locked; carry on when you are ready.'}
          </p>
          <button
            type="button"
            onClick={() => resetQuiz(slug)}
            className="btn btn-quiet btn-sm mt-4"
          >
            <ArrowCounterClockwise className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
        </div>
      )}
    </div>
  )
}
