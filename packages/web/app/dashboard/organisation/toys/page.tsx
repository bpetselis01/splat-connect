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
import { Archive, Package, Plus, Tag, PencilSimple, Gift } from '@phosphor-icons/react/dist/ssr'
import { OrgPickupForm, type OrgPickup } from '@/components/org-pickup-form'
import { GRADE_ICON } from '@/components/toy-library-card'
import { gradeOf } from '@/lib/toy-grade'
import type { Toy, ToyTransactionSummary } from '@splat-connect/types'

type OrgToy = Toy & { organizations: { name: string } | null }

export default async function OrgInventoryPage() {
  const caps = await getCapabilities()
  // The rail hides this row for a non-leader, but the rail is an affordance —
  // the page is its own control.
  if (!caps || caps.ledOrgs.length === 0) notFound()

  const [toys, handoffs, pickups] = await Promise.all([
    apiClient.get<OrgToy[]>('/api/toys/inventory').catch(() => [] as OrgToy[]),
    apiClient
      .get<ToyTransactionSummary[]>('/api/toy-transactions?role=owner')
      .catch(() => [] as ToyTransactionSummary[]),
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

  // Two of the board's four counts. "Out with families" and "Needs cleaning"
  // describe a lending shelf with returns, which the data does not model: a
  // handed-over toy changes owner rather than coming back.
  const ledIds = new Set(caps.ledOrgs.map((o) => o.id))
  const stats = [
    {
      k: 'On the shelf',
      v: toys.filter((t) => t.status === 'published').reduce((n, t) => n + t.quantity, 0),
    },
    {
      k: 'Delivered all time',
      v: handoffs.filter(
        (t) => t.owner_org_id && ledIds.has(t.owner_org_id) && t.toy_id && t.status === 'completed',
      ).length,
    },
  ]

  return (
    <div className="max-w-[980px]">
      <div className="dash-head mb-[18px]">
        <div>
          <h1 className="title-hub">Toy inventory</h1>
          <p className="dash-head__lede">What your organisation has on its shelves.</p>
        </div>
        <Link href="/dashboard/toys/new?for=org" className="btn btn-primary min-h-12 text-[15px]">
          <Plus weight="bold" aria-hidden="true" />
          Add to inventory
        </Link>
      </div>

      <ul className="count-chips">
        {stats.map((s) => (
          <li key={s.k} className="count-chip">
            <span className="count-chip__value">{s.v}</span>
            <span className="count-chip__label">{s.k}</span>
          </li>
        ))}
      </ul>

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
            <Archive className="h-8 w-8" weight="bold" aria-hidden="true" />
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
        <ul className="grid gap-3.5 sm:grid-cols-2">
          {toys.map((toy) => {
            const grade = gradeOf(toy.condition)
            const GradeIcon = GRADE_ICON[grade.key]
            const [status, tint] =
              toy.status === 'draft'
                ? ['Hidden', 'var(--surface2)']
                : toy.quantity === 0
                  ? ['Out of stock', 'var(--tamber)']
                  : ['Available', 'var(--tok)']
            return (
              <li key={toy.id}>
                <article className="row-card h-full gap-[13px] p-[18px]">
                  <div className="flex items-start gap-[13px]">
                    <span
                      aria-hidden="true"
                      className="grid h-14 w-14 flex-none place-items-center overflow-hidden rounded-2xl bg-sunken text-2xl text-muted"
                    >
                      {toy.cover_photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={toy.cover_photo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Gift weight="duotone" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="row-card__title">{toy.name}</h2>
                      <p className="mt-1 flex flex-wrap gap-1.5">
                        <span className="pill-tag" style={{ backgroundColor: grade.tint }}>
                          <GradeIcon weight="bold" aria-hidden="true" />
                          {grade.label}
                        </span>
                        <span className="pill-tag" style={{ backgroundColor: tint }}>
                          {status}
                        </span>
                      </p>
                    </div>
                  </div>
                  <p className="text-[13px] font-bold text-muted">
                    <Package weight="bold" aria-hidden="true" className="mr-1 inline text-brand-dark" />
                    {toy.quantity} in stock
                    {caps.ledOrgs.length > 1 && toy.organizations && <> · {toy.organizations.name}</>}
                  </p>
                  <div className="mt-auto flex flex-wrap items-center gap-2">
                    <Link
                      href={`/dashboard/toys/${toy.id}`}
                      className="btn btn-primary min-h-11 px-[18px] text-sm"
                    >
                      <PencilSimple weight="bold" aria-hidden="true" />
                      Edit
                    </Link>
                    {/* The public listing only exists once it is published. */}
                    {toy.status === 'published' && (
                      <Link href={`/toy-library/${toy.id}`} className="btn btn-quiet px-[15px] text-sm">
                        <Tag weight="bold" aria-hidden="true" />
                        Listing
                      </Link>
                    )}
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      )}

      <section className="mt-10">
        <h2 className="title-section">Pickup details</h2>
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
