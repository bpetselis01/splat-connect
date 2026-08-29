'use client'
/**
 * The Review step of the edit-tutorial stepper: a read-only summary of
 * everything the other steps collected.
 *
 * Submission is not here. It was, from the day the six-step wizard was
 * replaced until 2026-08-29, and putting it here fixed a real bug — a sticky
 * bar on every step let a contributor hand work over while looking at the
 * Tools tab, with no sight of what was about to be sent. But it created a
 * larger one: the bar existed *only* here, so every other step never
 * mentioned that submitting was a thing that happened, and a contributor could
 * fill in every field without ever finding the finish line.
 *
 * EditStepper renders the bar now, which keeps the reachability without giving
 * the summary up: the bar names what is still missing wherever you stand, and
 * this step remains the place that shows what is about to be sent.
 *
 * A client component again, but for one line rather than for the submit state
 * it used to carry: Team sits beside the rail instead of on it, so the walk
 * never passes through it, and this is the last place that can ask whether
 * anyone wants it. Opening a step is the stepper's job, reached through the
 * same context that delivers Next.
 */
import { CardPhoto } from '@/components/card-photo'
import { DifficultyBadge } from '@/components/difficulty-badge'
import { BackingSummary } from '@/components/backing-state'
import { PanelActions, useStepJump } from '@/components/panel-actions'
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

        <TeamPrompt />

        {/* Renders nothing here: Review is the last step of the walk, so there
            is nowhere onward, and the summary has no action of its own. It is
            present so the panel behaves like every other one if that ever
            changes. */}
        <PanelActions />
      </div>
    </div>
  )
}

/**
 * The one place the walk mentions Team. Both halves are optional and neither
 * blocks submitting, which is exactly why a contributor can reach the end
 * without knowing they exist — so the summary asks, on the step where "am I
 * done?" is the question already being answered.
 *
 * Renders nothing outside a stepper, where there is no step to open.
 */
function TeamPrompt() {
  const jump = useStepJump()
  if (!jump) return null

  return (
    <div className="card-flat flex flex-col gap-2 px-4 py-3">
      <p className="text-sm font-bold text-ink">Want to add collaborators or backers?</p>
      <p className="text-xs leading-relaxed text-muted">
        A collaborator edits this tutorial with you. A backer is an organisation that
        reviews it instead of SPLAT. Both are optional — you can submit without either.
      </p>
      <button
        type="button"
        onClick={() => jump('team')}
        className="btn btn-quiet btn-sm self-start"
      >
        Open Team →
      </button>
    </div>
  )
}
