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
import { CheckCircle } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'
import { formatRelativeTime } from '@/lib/relative-time'
import { Badge } from '@/components/badge'
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
        <h1 className="mb-4 title-hub">Review queue</h1>
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <span aria-hidden="true" className="empty-badge text-brand-deep">
  <CheckCircle className="h-8 w-8" />
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
      <h1 className="mb-2 title-hub">Review queue</h1>
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
      {/*
        A queue is a table on the board — GUIDE | CONTRIBUTOR | BACKING |
        WAITING | SAFETY — and a table is what a queue wants: rows an admin
        compares against each other, not cards read one at a time.

        Three of those five columns are here. CONTRIBUTOR and SAFETY are not:
        /api/admin/tutorials selects tutorial_contributors(profile_id) and no
        name, and there is no safety field at all. Resolving the name means a
        second admin-client query rather than an embed — embedding profiles
        silently kills the whole query under the 033/045 grants. Left for an API
        change rather than invented here.
      */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="eyebrow pb-2 pr-3 text-muted">Guide</th>
              <th scope="col" className="eyebrow pb-2 pr-3 text-muted">Backing</th>
              <th scope="col" className="eyebrow whitespace-nowrap pb-2 text-right text-muted">
                Waiting
              </th>
            </tr>
          </thead>
          <tbody>
            {tutorials.map((t) => {
              const accepted = acceptedFor(t)

              return (
                <tr key={t.id} className="border-b border-line align-middle last:border-0">
                  <td className="py-3 pr-3">
                    <Link
                      href={`/admin/review/${t.id}`}
                      className="flex items-center gap-3 no-underline"
                    >
                      <Badge status={t.difficulty as Difficulty} />
                      <span className="card-title">{t.title}</span>
                    </Link>
                  </td>
                  <td className="py-3 pr-3 text-sm text-muted">
                    {accepted.length > 0
                      ? accepted.map((b) => b.organizations?.name).filter(Boolean).join(', ')
                      : '—'}
                  </td>
                  <td className="whitespace-nowrap py-3 text-right font-mono text-sm tabular-nums text-muted">
                    {/* The repo's own helper rather than arithmetic on Date.now()
                        in render: that is impure, and reading the clock once per
                        row can straddle midnight and date two rows differently. */}
                    {formatRelativeTime(t.created_at)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
