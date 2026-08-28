import { notFound } from 'next/navigation'
import { ProfileTabs } from '@/components/profile-tabs'
import { TutorialCard } from '@/components/tutorial-card'
import { ToyLibraryCard } from '@/components/toy-library-card'
import { getSavedIds } from '@/lib/saves'
import type { OrgPublicProfile, Toy, ToyWithOwner } from '@splat-connect/types'

export default async function OrgPublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const res = await fetch(`${process.env.API_URL}/api/public/organizations/${id}`, {
    cache: 'no-store',
  })
  if (!res.ok) notFound()

  const org = (await res.json()) as OrgPublicProfile
  const initial = org.name.charAt(0).toUpperCase()

  // null means signed out — the island still renders, it just routes to
  // /signup instead of saving. Sets rather than .includes: the lookup runs
  // once per card.
  const saved = await getSavedIds()
  const signedIn = saved !== null
  const savedTutorials = new Set(saved?.tutorials ?? [])
  const savedToys = new Set(saved?.toys ?? [])

  // ToyLibraryCard names the current holder; here that's always this org, so
  // it's filled in from the page rather than a second embed the public
  // organisation endpoint doesn't return.
  const asHeld = (toy: Toy): ToyWithOwner => ({
    ...toy,
    profiles: null,
    organizations: { name: org.name },
  })

  const toysTotal = org.toysShared.length + org.toysDelivered.length
  const tutorialsTotal = org.tutorialsApproved.length + org.tutorialsBacked.length

  return (
    <div>
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="empty-badge rounded-2xl text-2xl font-bold text-brand-deep"
        >
          {initial}
        </span>
        <div>
          <h1 className="title-detail">{org.name}</h1>
          {org.status === 'suspended' && (
            <span className="badge mt-1 bg-sunken text-muted">SUSPENDED</span>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <div data-testid="org-stat-tutorials" className="card-flat px-4 py-5 text-center">
          <p className="text-2xl font-bold text-brand-deep">{tutorialsTotal}</p>
          <p className="mt-1 text-sm font-semibold text-muted">Tutorials</p>
        </div>
        <div data-testid="org-stat-toys-shared" className="card-flat px-4 py-5 text-center">
          <p className="text-2xl font-bold text-brand-deep">{org.toysShared.length}</p>
          <p className="mt-1 text-sm font-semibold text-muted">Toys shared</p>
        </div>
        <div data-testid="org-stat-toys-delivered" className="card-flat px-4 py-5 text-center">
          <p className="text-2xl font-bold text-brand-deep">{org.toysDelivered.length}</p>
          <p className="mt-1 text-sm font-semibold text-muted">Toys delivered</p>
        </div>
      </div>

      <ProfileTabs
        tabs={[
          {
            key: 'tutorials',
            label: 'Tutorials',
            content:
              tutorialsTotal === 0 ? (
                <p className="py-8 text-center text-sm text-muted">No tutorials yet.</p>
              ) : (
                <div className="space-y-6">
                  {org.tutorialsApproved.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-ink">Approved</h3>
                      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {org.tutorialsApproved.map((t) => (
                          <TutorialCard
                            key={t.id}
                            tutorial={t}
                            save={{ slug: 'tutorials', id: t.id, saved: savedTutorials.has(t.id), signedIn }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {org.tutorialsBacked.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-ink">Backed</h3>
                      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {org.tutorialsBacked.map((t) => (
                          <TutorialCard
                            key={t.id}
                            tutorial={t}
                            save={{ slug: 'tutorials', id: t.id, saved: savedTutorials.has(t.id), signedIn }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ),
          },
          {
            key: 'toys',
            label: 'Toys given',
            content:
              toysTotal === 0 ? (
                <p className="py-8 text-center text-sm text-muted">No toys yet.</p>
              ) : (
                <div className="space-y-6">
                  {org.toysShared.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-ink">Currently shared</h3>
                      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {org.toysShared.map((t) => (
                          <ToyLibraryCard
                            key={t.id}
                            toy={asHeld(t)}
                            save={{ slug: 'toys', id: t.id, saved: savedToys.has(t.id), signedIn }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {org.toysDelivered.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-ink">Delivered</h3>
                      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {org.toysDelivered.map((t) => (
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
