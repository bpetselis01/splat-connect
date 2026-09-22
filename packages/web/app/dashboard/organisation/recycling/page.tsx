/**
 * Recycling intake — what your machines can take, and the queue of booked
 * drop-offs.
 *
 * The queue comes first, as the board has it: somebody is at the door. Then
 * what the machines take — 059 puts `recycling_materials` and
 * `recycling_note` on the organisation, and the board edits them here as well
 * as on the profile (see what-you-take.tsx).
 *
 * Credit is minted in the queue, by weighing, and never
 * by the contributor — enforced by 059's split policies rather than by this
 * screen.
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCapabilities } from '@/lib/capabilities'
import { apiClient } from '@/lib/api-client'
import { CaretRight } from '@phosphor-icons/react/dist/ssr'
import { RecyclingIntake } from '@/components/recycling-intake'
import { WhatYouTake } from './what-you-take'
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

  return (
    <div className="max-w-[980px]">
      <nav
        aria-label="Recycling"
        className="mb-3.5 flex items-center gap-2 text-sm font-bold text-muted"
      >
        <Link href="/get-involved/recycling" className="text-brand-deep hover:underline">
          Recycling
        </Link>
        <CaretRight weight="bold" className="h-3 w-3" aria-hidden="true" />
        <span>Your intake</span>
      </nav>
      <h1 className="title-hub">Recycling intake</h1>
      <p className="mt-2.5 max-w-[64ch] text-[17px] text-muted">
        Publish what your machines take, then weigh what turns up. Credit is issued here and
        nowhere else.
      </p>

      <RecyclingIntake orgId={orgId} dropoffs={dropoffs} names={names} />

      <section>
        <h2 className="mb-1.5 mt-[38px] font-display text-2xl font-extrabold text-ink">
          What you can take
        </h2>
        <p className="mb-4 max-w-[66ch] text-sm text-muted">
          Contributors see this before they pack a box. Be specific — every unlisted item is one
          somebody has to pick out by hand.
        </p>
        <WhatYouTake
          orgId={orgId}
          materials={org.recycling_materials ?? []}
          note={org.recycling_note ?? null}
        />
      </section>
    </div>
  )
}
