'use client'
import { PanelActions } from '@/components/panel-actions'
/**
 * The MACS/BFMF quiz, now its own pill instead of a <dialog> launched from
 * inside the Ability panel. Answers stay local, same as before: only the
 * derived MACS/BFMF pair is worth persisting, and re-deriving it from stored
 * answers would mean versioning the question set.
 */
import { useState } from 'react'
import { useSave } from '@/components/use-save'
import { QUESTIONS, estimateAbility, type ChildProfile } from '@splat-connect/types'

export function ChildSurveyForm({
  onSave,
}: {
  profile: ChildProfile | null
  onSave: (fields: Partial<ChildProfile>) => Promise<void>
}) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => QUESTIONS.map(() => null))
  const { busy, error, saved, run } = useSave(onSave)

  const complete = answers.every((a) => a != null)

  async function estimateAndSave() {
    if (!complete) return
    const { macs, bfmf } = estimateAbility(answers as number[])
    await run({ macs_level: macs, bfmf_score: bfmf, macs_source: 'estimated', bfmf_source: 'estimated' })
  }

  return (
    <div className="flex flex-col gap-4 px-5 pb-5">
      <p className="text-sm leading-relaxed text-muted">
        Not sure of your child&apos;s MACS or BFMF level? Answer these questions and
        we&apos;ll estimate both for you.
      </p>
      {QUESTIONS.map((q, qi) => (
        <fieldset key={qi}>
          <legend className="field-label">{q.prompt}</legend>
          <div className="flex flex-wrap gap-2">
            {q.options.map((opt, oi) => (
              <button
                key={oi}
                type="button"
                aria-pressed={answers[qi] === oi}
                onClick={() => setAnswers((prev) => prev.map((a, i) => (i === qi ? oi : a)))}
                className="chip"
              >
                {opt}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      <PanelActions>
        <button type="button" onClick={estimateAndSave} disabled={!complete || busy} className="btn btn-accent">
          {busy ? 'Saving…' : 'Estimate & save'}
        </button>
        {error && <p role="alert" className="alert alert-danger">{error}</p>}
        {saved && <p className="text-sm font-semibold text-mint-deep">Saved</p>}
      </PanelActions>
    </div>
  )
}
