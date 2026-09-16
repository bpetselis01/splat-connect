import Link from 'next/link'
import type { Route } from 'next'
import { notFound } from 'next/navigation'
import { Hammer } from '@phosphor-icons/react/dist/ssr'
import { ProfileTabs } from '@/components/profile-tabs'
import { TutorialCard } from '@/components/tutorial-card'
import { ToyLibraryCard } from '@/components/toy-library-card'
import { getSavedIds } from '@/lib/saves'
import type { ContributorProfile, Toy, ToyWithOwner } from '@splat-connect/types'

export default async function ContributorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const res = await fetch(`${process.env.API_URL}/api/public/contributors/${id}`, {
    cache: 'no-store',
  })
  if (!res.ok) notFound()

  const contributor = (await res.json()) as ContributorProfile
  const initial = contributor.name.charAt(0).toUpperCase()

  // null means signed out — the island still renders, it just routes to
  // /signup instead of saving. Sets rather than .includes: the lookup runs
  // once per card.
  const saved = await getSavedIds()
  const signedIn = saved !== null
  const savedTutorials = new Set(saved?.tutorials ?? [])
  const savedToys = new Set(saved?.toys ?? [])

  // ToyLibraryCard names the current holder; here that's always this
  // contributor, so it's filled in from the page rather than a second embed
  // the public contributor endpoint doesn't return.
  const asHeld = (toy: Toy): ToyWithOwner => ({
    ...toy,
    profiles: { name: contributor.name },
    organizations: null,
  })

  return (
    <div>
      <div className="flex items-center gap-4">
        <span aria-hidden="true" className="empty-badge text-2xl font-bold text-brand-deep">
          {initial}
        </span>
        <h1 className="title-detail">{contributor.name}</h1>
      </div>

      {/* The only way to ask one person for a build. 057 gates that on the
          maker having a public profile, and this page IS the public profile —
          there is no directory of every account to ask from, which would be a
          spam surface nobody asked for. Signed out it routes to signup, the
          same rule the save island follows above. */}
      <div className="mt-4">
        <Link
          href={
            (signedIn
              ? `/get-involved/requests/new?maker=${id}`
              : '/signup?next=' + encodeURIComponent(`/get-involved/requests/new?maker=${id}`)) as Route
          }
          className="btn btn-quiet no-underline"
        >
          <Hammer size={18} weight="bold" aria-hidden="true" />
          Ask {contributor.name.split(' ')[0]} to build a guide
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <div data-testid="contributor-stat-tutorials" className="card-flat px-4 py-5 text-center">
          <p className="text-2xl font-bold text-brand-deep">{contributor.tutorials.length}</p>
          <p className="mt-1 text-sm font-semibold text-muted">Tutorials</p>
        </div>
        <div data-testid="contributor-stat-toys-shared" className="card-flat px-4 py-5 text-center">
          <p className="text-2xl font-bold text-brand-deep">{contributor.toysShared.length}</p>
          <p className="mt-1 text-sm font-semibold text-muted">Toys shared</p>
        </div>
        <div data-testid="contributor-stat-toys-delivered" className="card-flat px-4 py-5 text-center">
          <p className="text-2xl font-bold text-brand-deep">{contributor.toysDelivered.length}</p>
          <p className="mt-1 text-sm font-semibold text-muted">Toys delivered</p>
        </div>
      </div>

      <ProfileTabs
        tabs={[
          {
            key: 'tutorials',
            label: 'Tutorials',
            content:
              contributor.tutorials.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">No tutorials yet.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {contributor.tutorials.map((t) => (
                    <TutorialCard
                      key={t.id}
                      tutorial={t}
                      save={{ slug: 'tutorials', id: t.id, saved: savedTutorials.has(t.id), signedIn }}
                    />
                  ))}
                </div>
              ),
          },
          {
            key: 'toys',
            label: 'Toys given',
            content:
              contributor.toysShared.length === 0 && contributor.toysDelivered.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">No toys yet.</p>
              ) : (
                <div className="space-y-6">
                  {contributor.toysShared.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-ink">Currently shared</h3>
                      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {contributor.toysShared.map((t) => (
                          <ToyLibraryCard
                            key={t.id}
                            toy={asHeld(t)}
                            save={{ slug: 'toys', id: t.id, saved: savedToys.has(t.id), signedIn }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {contributor.toysDelivered.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-ink">Delivered</h3>
                      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {contributor.toysDelivered.map((t) => (
                          <ToyLibraryCard
                            key={t.id}
                            toy={asHeld(t)}
                            save={{ slug: 'toys', id: t.id, saved: savedToys.has(t.id), signedIn }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ),
          },
        ]}
      />
    </div>
  )
}
