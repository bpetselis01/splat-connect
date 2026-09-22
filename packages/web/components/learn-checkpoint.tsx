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
import { Circle, CheckCircle, XCircle } from '@phosphor-icons/react/dist/ssr'
import { SplatMascot } from '@/components/splat-mascot'
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
  questions,
  final,
}: {
  slug: string
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
      <ol className="mt-[30px] flex list-none flex-col gap-4 p-0">
        {questions.map((q, i) => {
          const chosen = given[i]
          const shown = ready && chosen !== undefined
          const right = chosen === q.a
          return (
            <li
              key={q.q}
              className="rounded-card border border-line bg-surface px-[26px] py-6 shadow-[var(--e2),var(--hi)]"
            >
              <p className="text-xs font-extrabold uppercase leading-6 tracking-[0.1em] text-muted">
                Question {i + 1} of {questions.length}
              </p>
              <h3 className="mb-4 mt-1.5 font-display text-[22px] font-extrabold leading-[1.25] text-ink [text-wrap:pretty]">
                {q.q}
              </h3>

              {/* Answered once, then held: the board locks a question on the
                  first pick so the explanation below it is about the answer
                  somebody actually gave. "Clear my answers" is the way back. */}
              <div role="group" aria-label={q.q} className="flex flex-col gap-2.5">
                {q.opts.map((opt, oi) => {
                  const isChosen = chosen === oi
                  const isRight = oi === q.a
                  // Once answered, the right one is marked whether or not it
                  // was picked — the reader needs to see which it was.
                  const tone = !shown
                    ? 'border-line bg-surface'
                    : isRight
                      ? 'border-success bg-[var(--tok)]'
                      : isChosen
                        ? 'border-danger bg-[var(--tbad)]'
                        : 'border-line bg-surface'
                  const Icon = !shown ? Circle : isRight ? CheckCircle : isChosen ? XCircle : Circle
                  const iconTone = !shown
                    ? 'text-line'
                    : isRight
                      ? 'text-success'
                      : isChosen
                        ? 'text-danger'
                        : 'text-line'
                  return (
                    <button
                      key={opt}
                      type="button"
                      aria-pressed={isChosen}
                      disabled={shown}
                      onClick={() => pick(i, oi)}
                      className={`flex min-h-[52px] items-center gap-3 rounded-[var(--radius-inset)] border-2 px-4 py-3 text-left text-[15.5px] font-bold text-ink transition-transform enabled:cursor-pointer enabled:hover:translate-x-[3px] disabled:cursor-default ${tone}`}
                    >
                      <Icon
                        size={22}
                        weight={!shown || (!isRight && !isChosen) ? 'regular' : 'fill'}
                        className={`flex-none ${iconTone}`}
                        aria-hidden="true"
                      />
                      {opt}
                    </button>
                  )
                })}
              </div>

              {shown && (
                <p
                  className={`mt-4 rounded-[var(--radius-inset)] px-[18px] py-3.5 text-[15px] leading-[1.55] text-[var(--tink)] ${
                    right ? 'bg-[var(--tok)]' : 'bg-[var(--tbad)]'
                  }`}
                >
                  {right ? (
                    <CheckCircle size={18} weight="fill" className="mr-2 inline align-[-3px]" aria-hidden="true" />
                  ) : (
                    <XCircle size={18} weight="fill" className="mr-2 inline align-[-3px]" aria-hidden="true" />
                  )}
                  {right ? 'Correct. ' : 'Not quite. '}
                  {q.why}
                </p>
              )}
            </li>
          )
        })}
      </ol>

      {ready && allAnswered && (
        <div
          className={`mt-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-5 rounded-card border border-line px-7 py-[26px] text-[var(--tink)] shadow-[var(--e3),var(--hi)] ${
            perfect ? 'bg-[var(--tok)]' : 'bg-[var(--tamber)]'
          }`}
        >
          <div>
            <p className="text-xs font-extrabold uppercase leading-6 tracking-[0.1em] opacity-75">
              {final ? 'Course complete' : 'Checkpoint done'}
            </p>
            <h3 className="my-1.5 font-display text-[26px] font-extrabold leading-[1.15]">
              {final
                ? perfect
                  ? 'You know this. Go build.'
                  : 'You finished the course.'
                : perfect
                  ? `All ${questions.length} right.`
                  : `${score} of ${questions.length} right.`}
            </h3>
            <p className="max-w-[56ch] text-base leading-[1.55]">
              {final
                ? 'Everything from here is practice. The Guides have step-by-step instructions for dozens of toys, and Makers Wanted has families waiting for exactly what you can now make.'
                : perfect
                  ? 'Nothing to revise. On to the next unit.'
                  : 'Read the explanations above — each one is the sentence you would want to remember at the bench. Nothing is locked; carry on when you are ready.'}
            </p>
            <button
              type="button"
              onClick={() => resetQuiz(slug)}
              className="mt-3 inline-flex min-h-11 cursor-pointer items-center text-sm font-extrabold text-[var(--tink)] underline"
            >
              Clear my answers and try again
            </button>
          </div>
          <div className="flex-none">
            <SplatMascot width={110} pose={perfect ? 'party' : 'think'} />
          </div>
        </div>
      )}
    </div>
  )
}
