/**
 * Admin Tutorial Review Queue
 *
 * Shows EVERY pending tutorial, including ones an organisation has already
 * accepted and is about to handle. Delegation removes the obligation to act, not
 * the visibility — so each row says who has it rather than disappearing.
 *
 * The hide link exists because a queue that never shrinks does not feel like the
 * bottleneck went away, which was the point of the whole feature. It defaults to
 * off: seeing everything is the safe default, and hiding is a deliberate act.
 *
 * Related files:
 * - packages/api/src/routes/admin.ts: GET /api/admin/tutorials, which embeds tutorial_orgs
 * - app/organizations/[id]: where a leader handles the ones marked accepted here
 */
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'
import { DifficultyBadge } from '@/components/difficulty-badge'
import type { Tutorial, TutorialOrg, Difficulty } from '@splat-connect/types'

type Queued = Tutorial & { tutorial_orgs?: TutorialOrg[] }

export default async function ReviewListPage({
  searchParams,
}: {
  searchParams: Promise<{ mine?: string }>
}) {
  const { mine } = await searchParams
  const all = await apiClient.get<Queued[]>('/api/admin/tutorials?status=pending')

  const acceptedFor = (t: Queued) =>
    (t.tutorial_orgs ?? []).filter((b) => b.status === 'accepted')
  const hidingHandled = mine === '1'
  const unhandled = all.filter((t) => acceptedFor(t).length === 0)
  const tutorials = hidingHandled ? unhandled : all
  const handledCount = all.length - unhandled.length

  if (tutorials.length === 0) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-bold text-ink">Tutorial review queue</h1>
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <span aria-hidden="true" className="empty-badge">
            ☕
          </span>
          <p className="mt-4 font-bold text-ink">
            {hidingHandled && handledCount > 0
              ? 'Nothing left for you.'
              : 'No tutorials pending review.'}
          </p>
          <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
            {hidingHandled && handledCount > 0 ? (
              <>
                {handledCount} {handledCount === 1 ? 'tutorial is' : 'tutorials are'} with an
                organisation. <Link href="/admin/review">Show everything</Link>.
              </>
            ) : (
              'Submissions land here the moment a contributor sends one for review.'
            )}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-ink">Tutorial review queue</h1>
      {handledCount > 0 && (
        <p className="mb-6 text-sm text-muted">
          {hidingHandled ? (
            <Link href="/admin/review">
              Show the {handledCount} an organisation is handling
            </Link>
          ) : (
            <Link href="/admin/review?mine=1">
              Hide the {handledCount} an organisation is handling
            </Link>
          )}
        </p>
      )}
      <div className="flex flex-col gap-3">
        {tutorials.map((t) => {
          const accepted = acceptedFor(t)
          return (
            <Link
              key={t.id}
              href={`/admin/review/${t.id}`}
              className="card card-link flex items-center justify-between gap-4 p-4"
            >
              <div className="flex items-center gap-3">
                <DifficultyBadge difficulty={t.difficulty as Difficulty} />
                <div>
                  <p className="text-sm font-bold text-ink">{t.title}</p>
                  <p className="text-xs text-muted">
                    Submitted {new Date(t.created_at).toLocaleDateString()}
                  </p>
                  {accepted.length > 0 && (
                    <p className="text-xs text-muted">
                      {accepted.map((b) => b.organizations?.name).filter(Boolean).join(', ')}{' '}
                      accepted — awaiting their review
                    </p>
                  )}
                </div>
              </div>
              <span className="shrink-0 text-sm font-semibold text-brand-dark">Review →</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
