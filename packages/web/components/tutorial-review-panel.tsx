'use client'
/**
 * The Review step of the edit-tutorial stepper: a read-only summary of
 * everything the other steps collected, and the submit gate.
 *
 * Submission used to live in a sticky bar rendered on every step, which meant
 * a contributor could hand work over while looking at, say, the Tools tab.
 * Moving it here matches toy-editor.tsx's Review panel and gives the decision a
 * page of its own where what is about to be sent is actually visible.
 *
 * As there, `.panel` wraps only the summary — it sets overflow:hidden, which
 * would kill the sticky bar's positioning if the bar lived inside it.
 */
import { useState } from 'react'
import { CardPhoto } from '@/components/card-photo'
import { DifficultyBadge } from '@/components/difficulty-badge'
import { BackingSummary } from '@/components/backing-state'
import { SaveStatusLine } from '@/components/save-status-line'
import type { Difficulty, TutorialStatus, TutorialOrg } from '@splat-connect/types'

export function TutorialReviewPanel({
  title,
  description,
  difficulty,
  toyPhotoUrl,
  hasPdf,
  partCount,
  toolCount,
  stlCount,
  backing,
  status,
  updatedAt,
  missingFields,
  onSubmit,
}: {
  title: string
  description: string | null
  difficulty: Difficulty
  toyPhotoUrl: string | null
  hasPdf: boolean
  partCount: number
  toolCount: number
  stlCount: number
  backing: TutorialOrg[]
  status: TutorialStatus
  updatedAt: string
  missingFields: string[]
  onSubmit: () => Promise<void>
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit()
    } catch {
      setError('Could not submit this tutorial. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="panel pt-5">
        <div className="flex flex-col gap-4 px-5 pb-5">
          <div className="max-w-xs overflow-hidden rounded-lg">
            <CardPhoto src={toyPhotoUrl} alt={title} />
          </div>

          <dl className="flex flex-col gap-2 text-sm">
            <div>
              <dt className="font-semibold text-ink">Title</dt>
              <dd>{title}</dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">Difficulty</dt>
              <dd className="mt-1">
                <DifficultyBadge difficulty={difficulty} />
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">Description</dt>
              <dd>{description || '—'}</dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">Tutorial PDF</dt>
              <dd>{hasPdf ? 'Uploaded' : 'Not uploaded'}</dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">Parts and tools</dt>
              <dd>
                {partCount} {partCount === 1 ? 'part' : 'parts'}, {toolCount}{' '}
                {toolCount === 1 ? 'tool' : 'tools'}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">STL files</dt>
              <dd>{stlCount === 0 ? 'None' : stlCount}</dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">Review route</dt>
              <dd>
                <BackingSummary backing={backing} />
              </dd>
            </div>
          </dl>

          {error && (
            <p role="alert" className="alert alert-danger">
              {error}
            </p>
          )}
        </div>
      </div>

      {status === 'draft' ? (
        <div className="sticky-submit-bar">
          <span className="sticky-submit-note">
            {missingFields.length > 0
              ? `Add ${missingFields.join(', ')} to submit`
              : 'Ready to submit'}
          </span>
          <button
            type="button"
            disabled={missingFields.length > 0 || submitting}
            onClick={submit}
            className="btn btn-accent"
          >
            {submitting ? 'Submitting…' : 'Submit for review'}
          </button>
        </div>
      ) : (
        <div className="sticky-submit-bar sticky-submit-bar-quiet">
          <SaveStatusLine savedAt={updatedAt} />
        </div>
      )}
    </>
  )
}
