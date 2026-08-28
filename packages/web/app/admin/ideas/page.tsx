/**
 * Admin design-challenge queue.
 *
 * Mirrors app/admin/review/page.tsx's shape: one list endpoint, pending
 * first, each row linking to its detail page. Unlike the tutorial queue this
 * has no "handled by someone else" state to filter, so it is the simpler
 * sibling — every idea, every status, pending pulled to the top because that
 * is the only status still waiting on this page's actions.
 *
 * Related files:
 * - packages/api/src/routes/admin.ts: GET /api/admin/ideas
 * - components/idea-status-badge.tsx: the status → copy/colour map, reused
 *   rather than a third copy of that logic
 */
import Link from 'next/link'
import type { Route } from 'next'
import { apiClient } from '@/lib/api-client'
import { IdeaStatusBadge } from '@/components/idea-status-badge'
import type { ToyIdea } from '@splat-connect/types'

type Queued = ToyIdea & { profiles: { name: string } | null }

export default async function AdminIdeasPage() {
  const all = await apiClient.get<Queued[]>('/api/admin/ideas')

  // Pending first — everything else is already decided and is here for
  // reference, not action.
  const ideas = [...all].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1
    if (a.status !== 'pending' && b.status === 'pending') return 1
    return 0
  })

  if (ideas.length === 0) {
    return (
      <div>
        <h1 className="mb-4 title-hub">Design challenge queue</h1>
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <span aria-hidden="true" className="empty-badge">
            💡
          </span>
          <p className="mt-4 font-bold text-ink">No ideas submitted yet.</p>
          <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
            Submissions land here the moment someone sends one in.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-6 title-hub">Design challenge queue</h1>
      <div className="flex flex-col gap-3">
        {ideas.map((idea) => (
          <Link
            key={idea.id}
            href={`/admin/ideas/${idea.id}` as Route<string>}
            className="card card-link flex items-center justify-between gap-4 p-4"
          >
            <div className="flex items-center gap-3">
              <IdeaStatusBadge status={idea.status} />
              <div>
                <p className="text-sm font-bold text-ink">{idea.title}</p>
                <p className="text-xs text-muted">
                  {idea.profiles?.name ?? 'Someone'} · Submitted{' '}
                  {new Date(idea.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <span className="shrink-0 text-sm font-semibold text-brand-dark">Review →</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
