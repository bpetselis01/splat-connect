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
import { MagnifyingGlass, BookOpenText } from '@phosphor-icons/react/dist/ssr'
import Image from 'next/image'
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'
import { shortDate } from '@/lib/dates'
import { safePhotoSrc } from '@/lib/photo-src'
import { tintFor } from '@/components/card-photo'
import type { Tutorial, TutorialOrg, AdminAccountsResponse } from '@splat-connect/types'

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
  const [sample, accounts] = await Promise.all([
    apiClient.get<Sampled[]>(`/api/admin/spot-check${query}`),
    // The approver's name, from the accounts list — embedding profiles kills
    // the query under the 033/045 grants.
    apiClient.get<AdminAccountsResponse>('/api/admin/contributors').catch(() => null),
  ])
  const nameOf = new Map((accounts?.accounts ?? []).map((a) => [a.id, a.name || a.email]))

  return (
    <div className="max-w-[960px]">
      <h1 className="title-hub mb-1.5">Spot-check</h1>
      <p className="mb-6 max-w-[62ch] text-[15px] text-muted">
        Guides an organisation leader approved. Audit a sample — repeatedly approving incomplete
        work suspends an organisation&apos;s ability to back guides.
      </p>

      {sample.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <span aria-hidden="true" className="empty-badge text-brand-deep">
            <MagnifyingGlass className="h-8 w-8" />
          </span>
          <p className="mt-4 font-bold text-ink">Nothing to check yet.</p>
          <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
            Tutorials appear here once an organisation leader has approved one.
          </p>
        </div>
      ) : (
        <ul className="flex list-none flex-col gap-3">
          {sample.map((t) => {
            const orgs = t.tutorial_orgs ?? []
            const org =
              orgs.find((b) => b.organizations?.id === t.reviewed_for_org_id)?.organizations?.name ??
              orgs
                .filter((b) => b.status === 'accepted')
                .map((b) => b.organizations?.name)
                .filter(Boolean)
                .join(', ')
            const who = t.reviewed_by ? nameOf.get(t.reviewed_by) : undefined
            const cover = safePhotoSrc(t.photo_urls?.[0] ?? null)
            return (
              <li
                key={t.id}
                className="card flex flex-wrap items-center gap-4 rounded-[18px] px-[22px] py-[18px]"
              >
                <span
                  aria-hidden="true"
                  className="relative grid h-14 w-14 flex-none place-items-center overflow-hidden rounded-[18px] text-ink"
                  style={{ background: tintFor(t.id) }}
                >
                  {cover ? (
                    <Image src={cover} alt="" fill sizes="56px" className="object-cover" />
                  ) : (
                    <BookOpenText size={26} weight="duotone" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <Link
                    href={`/admin/review/${t.id}`}
                    className="block text-base font-extrabold text-ink no-underline hover:underline"
                  >
                    {t.title}
                  </Link>
                  <span className="block text-[13px] text-muted">
                    Approved{who ? ` by ${who}` : ''}
                    {org ? ` for ${org}` : ''}
                    {t.reviewed_at ? ` · ${shortDate(t.reviewed_at)}` : ''}
                  </span>
                </span>
                {/* The board's "Looks right" has nothing to record it in, so it
                    is not drawn; Unpublish is the review page's own form. */}
                <span className="flex flex-none gap-2">
                  <Link
                    href={`/admin/review/${t.id}`}
                    className="btn btn-quiet btn-md text-[13px] font-bold"
                  >
                    Open
                  </Link>
                  <Link
                    href={`/admin/review/${t.id}#unpublish`}
                    className="btn btn-quiet btn-md text-[13px] font-bold text-danger"
                  >
                    Unpublish
                  </Link>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
