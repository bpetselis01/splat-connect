/**
 * Admin Spot-Check
 *
 * A random sample of tutorials approved by an organisation leader rather than by
 * the admin.
 *
 * WHY this page exists, because it is not obvious from the rows: there is no
 * self-review block. A leader may approve their own work, which is deliberate —
 * leadership is granted to someone already trusted, and a single-leader
 * organisation could otherwise never publish its leader's own tutorials. The
 * trade is that nothing warns the admin when an approval was a bad one. Every
 * control they have — remove the leader, suspend the organisation, reject the
 * tutorial — requires already knowing. Sampling is how they find out without
 * waiting for a complaint.
 *
 * Related files:
 * - packages/api/src/routes/admin.ts: GET /api/admin/spot-check
 * - supabase/migrations/007_organizations.sql: the review policy with no self-review conjunct
 */
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'
import { Badge } from '@/components/badge'
import type { Tutorial, TutorialOrg } from '@splat-connect/types'

type Sampled = Tutorial & { tutorial_orgs?: TutorialOrg[] }

export default async function SpotCheckPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string }>
}) {
  // The endpoint has always taken a limit; passing it through lets an admin
  // widen a sample that is too small to be worth refreshing, and lets a test ask
  // for the whole pool instead of hoping a random ten include the row it seeded.
  const { limit } = await searchParams
  const query = Number(limit) > 0 ? `?limit=${Number(limit)}` : ''
  const sample = await apiClient.get<Sampled[]>(`/api/admin/spot-check${query}`)

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-2 title-hub">Spot-check</h1>
      <p className="mb-6 text-sm leading-relaxed text-muted">
        A random sample of tutorials approved by organisation leaders rather than by
        you. Refresh for a different sample. Leaders can approve their own work, so
        this is how a bad approval surfaces before someone reports it. Open one to read
        it, and unpublish it if it should not be there.
      </p>

      {sample.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <span aria-hidden="true" className="empty-badge">
            🔍
          </span>
          <p className="mt-4 font-bold text-ink">Nothing to check yet.</p>
          <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
            Tutorials appear here once an organisation leader has approved one.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {sample.map((t) => {
            const backing = (t.tutorial_orgs ?? []).filter((b) => b.status === 'accepted')
            return (
              <li key={t.id}>
                {/* Whole card, not just the title — and a bare .card with no
                    padding was the other half of the same oversight. */}
                <Link href={`/admin/review/${t.id}`} className="card card-link p-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium text-ink">{t.title}</span>
                    <Badge status={t.difficulty} />
                  </div>
                  {backing.length > 0 && (
                    <p className="mt-2 text-sm text-muted">
                      Backed by{' '}
                      {backing.map((b) => b.organizations?.name).filter(Boolean).join(', ')}
                    </p>
                  )}
                  {t.reviewed_at && (
                    <p className="mt-1 text-xs text-muted">
                      Approved {new Date(t.reviewed_at).toLocaleDateString('en-AU')}
                    </p>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
