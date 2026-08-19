import Link from 'next/link'
import { CardPhoto } from './card-photo'
import { DifficultyBadge } from './difficulty-badge'
import { BackingSummary } from './backing-state'
import type { Tutorial, TutorialOrg } from '@splat-connect/types'

/** GET /api/public/tutorials embeds accepted backing on every row. */
type Listed = Tutorial & { tutorial_orgs?: TutorialOrg[] }

export function TutorialCard({ tutorial }: { tutorial: Listed }) {
  const backed = (tutorial.tutorial_orgs ?? []).some((b) => b.status === 'accepted')
  return (
    <Link
      href={`/tutorials/${tutorial.id}`}
      data-testid="tutorial-card"
      className="card-playroom card-link overflow-hidden"
    >
      <CardPhoto src={tutorial.toy_photo_url} />
      <div className="p-4">
        <p className="truncate text-sm font-bold text-ink">{tutorial.title}</p>
        {tutorial.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
            {tutorial.description}
          </p>
        )}
        {/* Only when an organisation actually backed it. BackingSummary's
            "Reviewed by SPLAT" fallback is for the contributor's own pages, where
            the review path means something; on a public card it is internal jargon
            to a parent, and the absence of a badge is the correct signal. */}
        {backed && <BackingSummary backing={tutorial.tutorial_orgs ?? []} />}
        <div className="mt-3">
          <DifficultyBadge difficulty={tutorial.difficulty} />
        </div>
      </div>
    </Link>
  )
}
