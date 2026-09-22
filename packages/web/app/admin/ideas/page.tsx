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
 * - components/badge.tsx: the status → copy/colour map, reused
 *   rather than a third copy of that logic
 */
import { Lightbulb } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import type { Route } from 'next'
import { apiClient } from '@/lib/api-client'
import { shortDate } from '@/lib/dates'
import type { ToyIdea, ToyIdeaStatus } from '@splat-connect/types'

// The board's four words for where an idea stands, on its tints.
const STATUS: Record<ToyIdeaStatus, { label: string; tint: string }> = {
  pending: { label: 'Pending', tint: 'var(--tamber)' },
  challenge: { label: 'Published', tint: 'var(--tok)' },
  graduated: { label: 'Being written up', tint: 'var(--b100)' },
  rejected: { label: 'Rejected', tint: 'var(--tbad)' },
}

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

  const header = (
    <>
      <h1 className="title-hub">Design challenges awaiting review</h1>
      <p className="mt-1.5 mb-6 max-w-[60ch] text-[15px] text-muted">
        Publish an idea as an open challenge, or reject it with a reason the author can act on.
      </p>
    </>
  )

  if (ideas.length === 0) {
    return (
      <div className="max-w-[960px]">
        {header}
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <span aria-hidden="true" className="empty-badge text-brand-deep">
            <Lightbulb className="h-8 w-8" />
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
    <div className="max-w-[960px]">
      {header}
      <ul className="flex list-none flex-col gap-3">
        {ideas.map((idea) => (
          <li key={idea.id}>
            <Link
              href={`/admin/ideas/${idea.id}` as Route<string>}
              className="card card-link rounded-[18px] px-[22px] py-5 text-ink no-underline"
            >
              <span className="flex items-start justify-between gap-4">
                <span className="font-display text-lg font-extrabold">{idea.title}</span>
                <span
                  className="admin-tag flex-none px-3"
                  style={{ background: STATUS[idea.status].tint }}
                >
                  {STATUS[idea.status].label}
                </span>
              </span>
              {idea.summary && (
                <span className="mt-2 block text-sm leading-[1.55] text-muted">{idea.summary}</span>
              )}
              <span className="mt-2.5 block text-[13px] font-semibold text-muted">
                {idea.profiles?.name ?? 'Someone'}
                {idea.created_at && ` · ${shortDate(idea.created_at)}`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
