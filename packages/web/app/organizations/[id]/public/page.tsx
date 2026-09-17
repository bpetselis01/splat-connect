import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Recycle } from '@phosphor-icons/react/dist/ssr'
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

      {/* 059's profile fields. Every one of them has an input on the editor at
          /dashboard/organisation/profile — a public field nobody can edit is a
          field that goes stale. */}
      {(org.capabilities ?? []).length > 0 && (
        <ul className="mt-4 flex list-none flex-wrap gap-2">
          {(org.capabilities ?? []).map((capability) => (
            <li key={capability} className="badge bg-sunken text-brand-deep">
              {capability}
            </li>
          ))}
        </ul>
      )}

      {org.about && (
        <p className="mt-4 max-w-prose whitespace-pre-line text-sm leading-relaxed text-ink">
          {org.about}
        </p>
      )}

      {(org.suburb || org.rate_note || org.contact_email || org.contact_phone || org.website_url) && (
        <dl className="mt-4 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
          {org.suburb && (
            <div>
              <dt className="text-[13px] uppercase tracking-wide text-muted">Where</dt>
              <dd className="mt-0.5 font-bold text-ink">
                {[org.suburb, org.state].filter(Boolean).join(', ')}
              </dd>
            </div>
          )}
          {org.rate_note && (
            <div>
              <dt className="text-[13px] uppercase tracking-wide text-muted">What they quote</dt>
              <dd className="mt-0.5 font-bold text-ink">{org.rate_note}</dd>
            </div>
          )}
          {(org.contact_email || org.contact_phone || org.website_url) && (
            <div>
              <dt className="text-[13px] uppercase tracking-wide text-muted">Reaching them</dt>
              <dd className="mt-0.5 font-bold text-ink">
                {[org.contact_email, org.contact_phone, org.website_url].filter(Boolean).join(' · ')}
              </dd>
            </div>
          )}
        </dl>
      )}

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

      {(org.events ?? []).length > 0 && (
        <section className="mt-8">
          <h2 className="title-section mb-3">What is on</h2>
          <ul className="flex list-none flex-col gap-2">
            {(org.events ?? []).map((event) => (
              <li key={event.id} className="rounded-[var(--radius-panel)] bg-canvas p-4">
                <p className="font-bold text-ink">{event.title}</p>
                <p className="text-sm text-muted">
                  {new Date(event.starts_at).toLocaleString('en-AU')} ·{' '}
                  {/* An online event's joining link is never public — the API
                      does not return it, so there is nothing here to leak. */}
                  {event.format === 'online' ? 'Online' : event.location}
                  {event.audience && ` · ${event.audience}`}
                </p>
                {event.summary && (
                  <p className="mt-1 text-sm leading-relaxed text-ink">{event.summary}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(org.stories ?? []).length > 0 && (
        <section className="mt-8">
          <h2 className="title-section mb-3">Stories</h2>
          <ul className="flex list-none flex-col gap-2">
            {(org.stories ?? []).map((story) => (
              <li key={story.id} className="rounded-[var(--radius-panel)] bg-canvas p-4">
                <p className="font-bold text-ink">{story.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink">{story.summary}</p>
                {/* Attributed to an organisation and a byline, always. */}
                <p className="mt-1 text-[13px] text-muted">{story.byline}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(org.recycling_materials ?? []).length > 0 && (
        // Was an inline booking form. The declaration is seven required lines
        // with a paragraph explaining why, and that does not belong beside a
        // list of guides — see components/dropoff-form.tsx. This states the
        // offer and links to the screen that takes it.
        <section className="card mt-8 flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center">
          <span aria-hidden="true" className="empty-badge shrink-0 text-brand-deep">
            <Recycle className="h-7 w-7" />
          </span>
          <div className="flex-1">
            <h2 className="text-base font-bold text-ink">Recycling</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              {org.name} takes {(org.recycling_materials ?? []).join(', ')} and issues print
              credit from the weight they record at the door.
            </p>
          </div>
          <Link
            href={
              signedIn
                ? `/get-involved/recycling/drop-off?org=${org.id}`
                : '/get-involved/recycling'
            }
            className="btn btn-quiet btn-sm shrink-0"
          >
            {signedIn ? 'Book a drop-off' : 'How recycling works'}
          </Link>
        </section>
      )}

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
