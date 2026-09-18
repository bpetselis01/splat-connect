/**
 * Recycling intake — what your machines can take, and the queue of booked
 * drop-offs.
 *
 * The first half is the profile editor's: 059 puts `recycling_materials` and
 * `recycling_note` on the organisation, because they are properties of the
 * organisation rather than of any one drop-off. This page shows them and links
 * there rather than carrying a second copy of the same two fields.
 *
 * The second half is the queue. Credit is minted here, by weighing, and never
 * by the contributor — enforced by 059's split policies rather than by this
 * screen.
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCapabilities } from '@/lib/capabilities'
import { apiClient } from '@/lib/api-client'
import { RecyclingIntake } from '@/components/recycling-intake'
import type { Organization, RecyclingDropoff } from '@splat-connect/types'

export const metadata = { title: 'Recycling intake — SPLAT Connect' }

export default async function OrgRecyclingPage() {
  const caps = await getCapabilities()
  if (!caps || caps.ledOrgs.length === 0) notFound()
  const orgId = caps.ledOrgs[0].id

  const [org, dropoffs] = await Promise.all([
    apiClient.get<Organization>(`/api/organizations/${orgId}`),
    apiClient
      .get<RecyclingDropoff[]>(`/api/organizations/${orgId}/recycling`)
      .catch(() => [] as RecyclingDropoff[]),
  ])

  /*
   * Contributor names, resolved here. A leader needs to know who is at the
   * door, and the browser cannot read another profile — `profiles` has no
   * policy admitting one account's row to another.
   */
  const names: Record<string, string> = {}
  await Promise.all(
    [...new Set(dropoffs.map((d) => d.contributor_id))].map(async (id) => {
      const person = await apiClient
        .get<{ name: string }>(`/api/public/makers/${id}`)
        .catch(() => null)
      if (person) names[id] = person.name
    })
  )

  const takes = org.recycling_materials ?? []

  return (
    <div>
      <div className="mb-6">
        <h1 className="title-hub">Recycling intake</h1>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
          Waste plastic in, filament out — weighed at your door, never before.
        </p>
      </div>

      <section className="card mb-8 flex flex-col gap-2 p-5">
        <h2 className="text-base font-bold text-ink">What your machines can take</h2>
        {takes.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted">
            Nothing listed, so nobody can book a drop-off with you yet.
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-ink">{takes.join(', ')}</p>
        )}
        {org.recycling_note && (
          <p className="text-sm leading-relaxed text-muted">{org.recycling_note}</p>
        )}
        <Link href="/dashboard/organisation/profile" className="btn btn-quiet self-start no-underline">
          Change what you take
        </Link>
      </section>

      <RecyclingIntake orgId={orgId} dropoffs={dropoffs} names={names} />
    </div>
  )
}
