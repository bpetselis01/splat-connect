/**
 * An organisation's toy inventory — its shelf, not a leader's own toys.
 *
 * Merged across every organisation the leader runs and badged per row, the same
 * arrangement app/dashboard/organisation uses for the review queue: leadership
 * is per-organisation data, and a leader of two should not have to pick one
 * before seeing anything.
 *
 * Deliberately separate from My Toys. `GET /api/toys` filters on owner_id and
 * returns none of this, so a leader can always tell what is theirs to give away
 * personally from what belongs to the association.
 *
 * Related files:
 * - app/dashboard/organisation: the review queue this sits beside
 * - components/org-pickup-form: the address without which nothing can be accepted
 * - lib/org-access.ts: the same "affordance, not control" rule this notFound() follows
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { getCapabilities } from '@/lib/capabilities'
import { CardPhoto } from '@/components/card-photo'
import { Badge } from '@/components/badge'
import { OrgPickupForm, type OrgPickup } from '@/components/org-pickup-form'
import { Shelf } from '@/components/icons'
import type { Toy } from '@splat-connect/types'

type OrgToy = Toy & { organizations: { name: string } | null }

export default async function OrgInventoryPage() {
  const caps = await getCapabilities()
  // The rail hides this row for a non-leader, but the rail is an affordance —
  // the page is its own control.
  if (!caps || caps.ledOrgs.length === 0) notFound()

  const [toys, pickups] = await Promise.all([
    apiClient.get<OrgToy[]>('/api/toys/inventory').catch(() => [] as OrgToy[]),
    Promise.all(
      caps.ledOrgs.map(async (org) => ({
        org,
        pickup: await apiClient
          .get<OrgPickup>(`/api/organizations/${org.id}/pickup`)
          .catch(() => null),
      }))
    ),
  ])

  const missingPickup = pickups.filter((p) => !p.pickup?.pickup_line1)

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="title-hub">Toy inventory</h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
            Stock your organisation offers for donation or exchange. Say how many you hold and
            families can ask for one; the count drops as each is handed over.
          </p>
        </div>
        <Link href="/dashboard/toys/new?for=org" className="btn btn-accent">
          + Add stock
        </Link>
      </div>

      {/* Named before the list, because an organisation without one can accept
          nothing at all — every request would fail at the last step. */}
      {missingPickup.length > 0 && (
        <p role="alert" className="alert alert-warning mb-6">
          {missingPickup.map((p) => p.org.name).join(', ')}{' '}
          {missingPickup.length === 1 ? 'has' : 'have'} no pickup address yet, so requests cannot be
          accepted. Set one below.
        </p>
      )}

      {toys.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <span aria-hidden="true" className="empty-badge text-brand-dark">
            <Shelf className="h-8 w-8" />
          </span>
          <p className="mt-4 font-bold text-ink">No stock listed yet.</p>
          <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
            Add a toy and say how many you hold — five of the same bear is one listing, not five.
          </p>
          <Link href="/dashboard/toys/new?for=org" className="btn btn-accent mt-6">
            Add stock
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {toys.map((toy) => (
            <li key={toy.id}>
              <Link href={`/dashboard/toys/${toy.id}`} className="card card-link overflow-hidden">
                <CardPhoto src={toy.cover_photo_url} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-bold text-ink">{toy.name}</p>
                    <Badge status={toy.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted">{toy.organizations?.name}</p>
                  <p className="mt-1 text-xs font-bold text-ink">
                    {toy.quantity === 0 ? 'Out of stock' : `${toy.quantity} in stock`}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-bold text-ink">Pickup details</h2>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted">
          Where families collect from. Fixed for every handoff — unlike a person-to-person
          exchange, this is not chosen per request.
        </p>
        <div className="mt-4 flex flex-col gap-6">
          {pickups.map(({ org, pickup }) => (
            <div key={org.id} className="panel p-5">
              <h3 className="mb-4 font-bold text-ink">{org.name}</h3>
              <OrgPickupForm
                orgId={org.id}
                pickup={
                  pickup ?? {
                    pickup_line1: null,
                    pickup_suburb: null,
                    pickup_state: null,
                    pickup_postcode: null,
                    pickup_instructions: null,
                  }
                }
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
