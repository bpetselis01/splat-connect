/**
 * A tutorial as it appears in the contributor's own list, as distinct from
 * tutorial-card.tsx, which is the public library's.
 *
 * The two differ in what they are for, not just how they look: this one links
 * to the editor, always states the review route (a contributor needs to know
 * their work sits with SPLAT even when no organisation backed it), and carries
 * the status and any rejection note. The public card deliberately hides all of
 * that as internal jargon.
 *
 * Difficulty is overlaid on the photo rather than sitting in the text block, so
 * it holds one position down a column and can be scanned without reading. It is
 * a property of the build; the line below is about the review, and mixing the
 * two reads as one undifferentiated row of badges.
 */
import Link from 'next/link'
import { CardPhoto } from '@/components/card-photo'
import { DifficultyBadge } from '@/components/difficulty-badge'
import { StatusBadge } from '@/components/status-badge'
import { BackingSummary } from '@/components/backing-state'
import type { Tutorial, Difficulty, TutorialOrg } from '@splat-connect/types'

type Listed = Tutorial & { tutorial_orgs?: TutorialOrg[] }

export function DashboardTutorialCard({ tutorial }: { tutorial: Listed }) {
  return (
    <Link
      href={`/tutorials/${tutorial.id}/edit`}
      data-testid="tutorial-row"
      className="card card-link flex h-full flex-col overflow-hidden"
    >
      <div className="relative">
        <CardPhoto src={tutorial.toy_photo_url} alt={tutorial.title} />
        {/* Badges carry solid backgrounds, so this stays legible over any photo. */}
        <span className="absolute left-2 top-2">
          <DifficultyBadge difficulty={tutorial.difficulty as Difficulty} />
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="truncate text-sm font-bold text-ink">{tutorial.title}</p>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={tutorial.status} />
          <BackingSummary backing={tutorial.tutorial_orgs ?? []} />
        </div>
        {tutorial.status === 'rejected' && (
          // Clamped so one long note cannot stretch its row of cards. The whole
          // note has a home in the callout at the top of the edit page.
          <p className="line-clamp-2 text-xs leading-relaxed text-danger">
            {tutorial.rejection_note ?? 'No feedback was provided.'}
          </p>
        )}
      </div>
    </Link>
  )
}
