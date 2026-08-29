/**
 * The Review step of the edit-tutorial stepper: a read-only summary of
 * everything the other steps collected.
 *
 * Submission is not here. It was, from the day the six-step wizard was
 * replaced until 2026-08-29, and putting it here fixed a real bug — a sticky
 * bar on every step let a contributor hand work over while looking at the
 * Tools tab, with no sight of what was about to be sent. But it created a
 * larger one: the bar existed *only* here, so the other seven steps never
 * mentioned that submitting was a thing that happened, and a contributor could
 * fill in every field without ever finding the finish line.
 *
 * EditStepper renders the bar now, which keeps the reachability without giving
 * the summary up: the bar names what is still missing wherever you stand, and
 * this step remains the place that shows what is about to be sent.
 *
 * No longer a client component — with the submit state gone there is nothing
 * left here to hold.
 */
import { CardPhoto } from '@/components/card-photo'
import { DifficultyBadge } from '@/components/difficulty-badge'
import { BackingSummary } from '@/components/backing-state'
import { PanelActions } from '@/components/panel-actions'
import type { Difficulty, TutorialOrg } from '@splat-connect/types'

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
}) {
  return (
    <div className="panel pt-5">
      <div className="flex flex-col gap-4 px-5 pb-5">
        <div className="max-w-xs overflow-hidden rounded-lg">
          <CardPhoto src={toyPhotoUrl} />
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

        {/* Renders nothing here: Review is the last step, so there is nowhere
            onward, and the summary has no action of its own. It is present so
            the panel behaves like every other one if that ever changes. */}
        <PanelActions />
      </div>
    </div>
  )
}
