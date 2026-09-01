'use client'
import { PanelActions } from '@/components/panel-actions'
/**
 * The hand-use questions, now their own pill instead of a <dialog> launched
 * from inside the Ability panel. Answers stay local, same as before: only the
 * derived internal fit pair is worth persisting, and re-deriving it from
 * stored answers would mean versioning the question set.
 *
 * Copy here is deliberate (see /legal/intended-purpose): the questions are
 * framed as fitting/matching, never as estimating a clinical score for the
 * parent. Do not reintroduce MACS/BFMF names or "estimate" into this UI.
 */
import { useState } from 'react'
import { useSave } from '@/components/use-save'
import { QUESTIONS, deriveFitProfile, type ChildProfile } from '@splat-connect/types'

export function ChildSurveyForm({
  onSave,
}: {
  profile: ChildProfile | null
  onSave: (fields: Partial<ChildProfile>) => Promise<void>
}) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => QUESTIONS.map(() => null))
  const { busy, error, saved, run } = useSave(onSave)

  const complete = answers.every((a) => a != null)

  async function saveAnswers() {
    if (!complete) return
    const { macsInternal, bfmfInternal } = deriveFitProfile(answers as number[])
    await run({ macs_level: macsInternal, bfmf_score: bfmfInternal, macs_source: 'estimated', bfmf_source: 'estimated' })
  }

  return (
    <div className="flex flex-col gap-4 px-5 pb-5">
      <p className="text-sm leading-relaxed text-muted">
        A few questions about how your child uses their hands. We use your answers to
        suggest guides and devices that are likely to suit them. This is not an
        assessment, and it doesn&apos;t replace advice from your child&apos;s
        occupational therapist.
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
        <button type="button" onClick={saveAnswers} disabled={!complete || busy} className="btn btn-accent">
          {busy ? 'Saving…' : 'Save answers'}
        </button>
        {error && <p role="alert" className="alert alert-danger">{error}</p>}
        {saved && <p className="text-sm font-semibold text-mint-deep">Saved — we&apos;ll use this to suggest guides</p>}
      </PanelActions>
    </div>
  )
}
