'use client'
/**
 * Up to three other tutorials the creator points readers at — the Recommended
 * step of the edit-tutorial stepper.
 *
 * Every change writes straight away, the way EditCollaboratorsSection's
 * invite and remove do, rather than through a dirty flag and a Save button:
 * a pick from a list is already the whole edit, and there is nothing to type
 * that a walk-away could lose.
 *
 * The picker offers only approved tutorials, because /api/public/tutorials is
 * where the list comes from. A row can still be unapproved — it was approved
 * when chosen and has since gone back into review, or it was picked before
 * approval by an admin — and the public page silently drops those. The tag on
 * such a row is the only place the creator learns that.
 *
 * Related files:
 * - packages/api/src/routes/recommendations.ts: the replace-all write
 * - components/tutorial-view.tsx: where a parent sees the result
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/toast'
import { PanelActions } from '@/components/panel-actions'
import { KIND_LABEL, type Recommendation, type Tutorial } from '@splat-connect/types'

/** Mirrors 048's `position between 1 and 3`; the constraint is the rule, this
 *  is what keeps the editor from ever offering a fourth slot. */
export const MAX_RECOMMENDATIONS = 3

export function EditRecommendationsSection({
  tutorialId,
  recommendations,
  candidates,
  onSave,
}: {
  tutorialId: string
  recommendations: Recommendation[]
  /** Approved tutorials, from /api/public/tutorials. */
  candidates: Pick<Tutorial, 'id' | 'title' | 'kind'>[]
  /** The full list, in order — the route replaces rather than appends. */
  onSave: (recommendedIds: string[]) => Promise<void>
}) {
  const router = useRouter()
  const showToast = useToast()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const chosen = recommendations.map((r) => r.tutorials.id)
  const options = candidates.filter((t) => t.id !== tutorialId && !chosen.includes(t.id))

  async function save(ids: string[], toastMessage: string) {
    setPending(true)
    setError(null)
    try {
      await onSave(ids)
      showToast(toastMessage)
      router.refresh()
    } catch {
      setError('That did not work. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="px-5 pb-5">
      <p className="mb-4 max-w-prose text-sm leading-relaxed text-muted">
        Up to three tutorials worth looking at alongside this one. Parents only
        see the ones that have been approved.
      </p>

      {recommendations.length > 0 && (
        <ul className="mb-4 flex flex-col gap-2">
          {recommendations.map((r) => (
            <li key={r.tutorials.id} className="card-flat flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
              <span className="font-semibold text-ink">{r.tutorials.title}</span>
              <span className="badge bg-sunken text-brand-deep">{KIND_LABEL[r.tutorials.kind]}</span>
              {r.tutorials.status !== 'approved' && (
                <span className="badge bg-honey-soft text-honey-deep">
                  Not yet approved — hidden from the public page
                </span>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => save(chosen.filter((id) => id !== r.tutorials.id), 'Recommendation removed')}
                className="btn btn-ghost btn-sm ml-auto"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {recommendations.length < MAX_RECOMMENDATIONS && (
        <div>
          <label htmlFor="add-recommendation" className="field-label">Add a recommendation</label>
          {/* Controlled to '' so the select resets after each pick; the row it
              adds appears in the list above once the page refreshes. */}
          <select
            id="add-recommendation"
            value=""
            disabled={pending || options.length === 0}
            onChange={(e) => e.target.value && save([...chosen, e.target.value], 'Recommendation added')}
            className="field"
          >
            <option value="">
              {options.length === 0 ? 'No other approved tutorials yet' : 'Choose a tutorial…'}
            </option>
            {options.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} — {KIND_LABEL[t.kind]}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <p role="alert" className="alert alert-danger mt-3">
          {error}
        </p>
      )}
      <PanelActions />
    </div>
  )
}
