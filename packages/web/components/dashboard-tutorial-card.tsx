/**
 * A tutorial as it appears in the contributor's own list, as distinct from
 * tutorial-card.tsx, which is the public library's.
 *
 * The two differ in what they are for, not just how they look: this one links
 * to the editor, always states the review route (a contributor needs to know
 * their work sits with SPLAT even when no organisation backed it), and carries
 * the stage and any rejection note. The public card deliberately hides all of
 * that as internal jargon.
 *
 * The board's card: a tinted 4:3 band, the title, a stage pill beside a
 * difficulty pill, one line about where it is up to, and a hairline footer
 * with who is reviewing it on the left and when it last moved on the right.
 */
import { BookOpen, CircleHalf, Fire, Smiley } from '@phosphor-icons/react/dist/ssr'
import { CardPhoto, tintFor } from '@/components/card-photo'
import { BackingSummary } from '@/components/backing-state'
import { BoundaryLink } from '@/components/boundary-link'
import { StagePill, type StageKey } from '@/components/stage'
import type { Tutorial, Difficulty, TutorialOrg, TutorialStatus } from '@splat-connect/types'

type Listed = Tutorial & { tutorial_orgs?: TutorialOrg[] }

/** The editor's status → the board's shared stage vocabulary. */
export const TUTORIAL_STAGE: Record<TutorialStatus, StageKey> = {
  approved: 'live',
  pending: 'waiting',
  rejected: 'needsyou',
  draft: 'hidden',
}

const DIFF: Record<Difficulty, { label: string; tint: string; Icon: typeof Fire }> = {
  easy: { label: 'Easy', tint: 'var(--tok)', Icon: Smiley },
  medium: { label: 'Medium', tint: 'var(--tamber)', Icon: CircleHalf },
  hard: { label: 'Hard', tint: 'var(--tcoral)', Icon: Fire },
}

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : ''

function when(t: Listed): string {
  switch (t.status) {
    case 'draft':
      return `Saved ${day(t.updated_at)}`
    case 'pending':
      return `Submitted ${day(t.updated_at)}`
    case 'rejected':
      return `Returned ${day(t.reviewed_at ?? t.updated_at)}`
    default:
      return `Updated ${day(t.updated_at)}`
  }
}

export function DashboardTutorialCard({ tutorial }: { tutorial: Listed }) {
  const diff = DIFF[tutorial.difficulty as Difficulty]
  return (
    <BoundaryLink
      href={`/tutorials/${tutorial.id}/edit`}
      data-testid="tutorial-row"
      className="card card-link flex h-full flex-col overflow-hidden"
    >
      <CardPhoto
        src={tutorial.toy_photo_url}
        icon={BookOpen}
        tint={tintFor(tutorial.id)}
        iconSize={74}
      />

      <div className="flex flex-1 flex-col gap-2.5 px-[18px] pb-[18px] pt-4">
        <p className="text-lg font-extrabold leading-[1.3] text-ink">{tutorial.title}</p>
        <div className="flex flex-wrap items-center gap-2">
          <StagePill
            stage={TUTORIAL_STAGE[tutorial.status]}
            label={tutorial.status === 'draft' ? 'Draft' : undefined}
          />
          {diff && (
            <span className="stage-pill gap-1" style={{ background: diff.tint, color: 'var(--tink)' }}>
              <diff.Icon weight="fill" aria-hidden="true" />
              {diff.label}
            </span>
          )}
        </div>
        <div className="flex-1">
          {tutorial.status === 'rejected' && (
            // Clamped so one long note cannot stretch its row of cards. The whole
            // note has a home in the callout at the top of the edit page.
            <p className="line-clamp-2 text-[13px] leading-relaxed text-muted">
              {tutorial.rejection_note ?? 'No feedback was provided.'}
            </p>
          )}
        </div>
        <div className="flex justify-between gap-3 border-t border-line pt-2.5 text-xs font-semibold text-muted">
          <div className="min-w-0 truncate [&_*]:mt-0 [&_*]:truncate [&_*]:text-xs [&_*]:font-semibold [&_*]:text-muted">
            <BackingSummary backing={tutorial.tutorial_orgs ?? []} />
          </div>
          <span className="flex-none">{when(tutorial)}</span>
        </div>
      </div>
    </BoundaryLink>
  )
}
