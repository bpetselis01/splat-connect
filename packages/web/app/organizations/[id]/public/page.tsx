/**
 * An organisation's public profile, in the board's shape: a header card, a
 * jump row, a main column of what they do and a rail of how to reach them.
 *
 * Only what the public endpoint returns is drawn. The board also has a cover
 * photo and logo, a "Verified by SPLAT" seal, follow/message/thanks actions,
 * notes from families, named leaders, a street address and opening hours —
 * none of which exist as public data yet, so none are here.
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Route } from 'next'
import Image from 'next/image'
import {
  Buildings,
  CalendarDots,
  CaretRight,
  Check,
  EnvelopeSimple,
  Flag,
  Globe,
  MapPin,
  Newspaper,
  Phone,
  Printer,
  Recycle,
} from '@phosphor-icons/react/dist/ssr'
import { initials } from '@/components/story-bits'
import { ShelfToyCard } from '@/components/shelf-toy-card'
import { tintFor } from '@/components/card-photo'
import { safePhotoSrc } from '@/lib/photo-src'
import { shortDate } from '@/lib/dates'
import { getCapabilities } from '@/lib/capabilities'
import { formatBuildTime, type OrgPublicProfile, type Tutorial } from '@splat-connect/types'

const CHIP_TINTS = ['var(--tok)', 'var(--b100)', 'var(--tamber)', 'var(--tcoral)', 'var(--tviolet)', 'var(--tmint)']
const DIFFICULTY_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' } as const

const H2 = 'font-display text-2xl font-extrabold text-ink'
const RAIL_CARD = 'flex flex-col gap-3 rounded-card border border-line p-[22px]'

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
  const signedIn = !!(await getCapabilities())

  // Backed and reviewed are one list on the board: guides with this
  // organisation's name on them.
  const guides: Tutorial[] = [
    ...org.tutorialsApproved,
    ...org.tutorialsBacked.filter((t) => !org.tutorialsApproved.some((a) => a.id === t.id)),
  ]
  const place = [org.suburb, org.state].filter(Boolean).join(', ')
  const capabilities = org.capabilities ?? []
  const recycles = (org.recycling_materials ?? []).length > 0
  const prints = !!org.rate_note || capabilities.includes('Has a printer')
  const reach = org.website_url || org.contact_email || org.contact_phone || place

  // Stories and events, newest first, as the board's "Recent activity" feed.
  const activity = [
    ...(org.stories ?? []).map((s) => ({
      key: `s-${s.id}`,
      icon: Newspaper,
      tint: 'var(--tcoral)',
      t: `Published a story — ${s.title}`,
      when: s.created_at,
      href: `/about/stories/${s.id}` as Route,
    })),
    ...(org.events ?? []).map((e) => ({
      key: `e-${e.id}`,
      icon: CalendarDots,
      tint: 'var(--b100)',
      t: `${e.title} — ${e.format === 'online' ? 'Online' : e.location}`,
      when: e.starts_at,
      href: `/get-involved/events/${e.id}` as Route,
    })),
  ].sort((a, b) => (a.when < b.when ? 1 : -1))

  const jumps = [
    { to: 'org-about', label: 'About', show: true },
    { to: 'org-guides', label: 'Guides', show: guides.length > 0 },
    { to: 'org-toys', label: 'Toys', show: org.toysShared.length > 0 },
    { to: 'org-activity', label: 'Activity', show: activity.length > 0 },
  ].filter((j) => j.show)

  const stats = [
    { n: org.tutorialsBacked.length, label: 'guides backed' },
    { n: org.tutorialsApproved.length, label: 'guides reviewed' },
    { n: org.toysShared.length, label: 'toys on the shelf' },
    { n: org.toysDelivered.length, label: 'toys delivered' },
  ]

  return (
    <div>
      <nav
        aria-label="Breadcrumb"
        className="mb-[18px] flex items-center gap-2 text-sm font-bold text-muted"
      >
        <Link href="/organizations" className="text-[var(--b700)]">
          Organisations
        </Link>
        <CaretRight size={12} weight="bold" aria-hidden="true" />
        <span className="text-ink">{org.name}</span>
      </nav>

      <div
        className="overflow-hidden rounded-card border border-line bg-surface"
        style={{ boxShadow: 'var(--shadow-e3)' }}
      >
        <div aria-hidden="true" className="h-[220px] bg-[var(--tmint)]" />
        <div className="flex flex-wrap items-start gap-x-6 gap-y-[22px] px-8 pb-7">
          <span
            aria-hidden="true"
            className="-mt-12 grid h-28 w-28 shrink-0 place-items-center rounded-card border-4 border-surface bg-surface font-display text-4xl font-extrabold text-[var(--tink)]"
            style={{ boxShadow: 'var(--shadow-e3)' }}
          >
            {initials(org.name)}
          </span>
          <div className="min-w-0 flex-[1_1_340px] pt-[18px]">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-[clamp(28px,3vw,38px)] font-extrabold leading-[1.1] tracking-[-0.02em] text-ink">
                {org.name}
              </h1>
              {org.status === 'suspended' && (
                <span className="badge bg-sunken text-muted">SUSPENDED</span>
              )}
            </div>
            {(org.description || place) && (
              <p className="mt-2 flex flex-wrap items-center gap-3.5 text-sm font-semibold text-muted">
                {org.description && (
                  <span>
                    <Buildings size={14} weight="bold" className="mr-1 inline text-[var(--b600)]" aria-hidden="true" />
                    {org.description}
                  </span>
                )}
                {place && (
                  <span>
                    <MapPin size={14} weight="bold" className="mr-1 inline text-[var(--b600)]" aria-hidden="true" />
                    {place}
                  </span>
                )}
              </p>
            )}
            {/* 059's capability chips. Every one has an input on the editor at
                /dashboard/organisation/profile — a public field nobody can
                edit is a field that goes stale. */}
            {capabilities.length > 0 && (
              <ul className="mt-3 flex list-none flex-wrap gap-2">
                {capabilities.map((capability, i) => (
                  <li
                    key={capability}
                    className="inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-[13px] font-extrabold text-[var(--tink)]"
                    style={{ background: CHIP_TINTS[i % CHIP_TINTS.length] }}
                  >
                    <Check size={13} weight="bold" aria-hidden="true" />
                    {capability}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {jumps.length > 1 && (
        <nav
          aria-label="On this page"
          className="sticky top-3 z-[5] mt-5 flex w-max max-w-full gap-1.5 overflow-auto rounded-pill border border-line bg-surface p-1.5"
          style={{ boxShadow: 'var(--shadow-e2)' }}
        >
          {jumps.map((j) => (
            <a
              key={j.to}
              href={`#${j.to}`}
              className="inline-flex min-h-11 items-center whitespace-nowrap rounded-pill px-4 text-sm font-extrabold text-ink hover:bg-sunken"
            >
              {j.label}
            </a>
          ))}
        </nav>
      )}

      <div className="mt-7 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-10">
          <section id="org-about">
            <h2 className={`${H2} mb-2.5`}>About</h2>
            {org.about && (
              <p className="m-0 max-w-[64ch] whitespace-pre-line text-base leading-[1.6] text-ink">
                {org.about}
              </p>
            )}
            <div className="mt-[22px] grid grid-cols-2 gap-3 sm:grid-cols-4">
              {stats.map((k) => (
                <div
                  key={k.label}
                  className="rounded-[var(--radius-inset)] border border-line bg-surface px-[18px] py-4"
                  style={{ boxShadow: 'var(--shadow-e1)' }}
                >
                  <p className="m-0 font-display text-[30px] font-extrabold leading-none tracking-[-0.02em] tabular-nums text-ink">
                    {k.n}
                  </p>
                  <p className="mt-1.5 text-[13px] font-bold text-muted">{k.label}</p>
                </div>
              ))}
            </div>
          </section>

          {guides.length > 0 && (
            <section id="org-guides">
              <h2 className={`${H2} mb-3.5`}>
                Guides they back{' '}
                <span className="text-base font-semibold text-muted">{guides.length}</span>
              </h2>
              <p className="-mt-1.5 mb-3.5 max-w-[64ch] text-[13px] text-muted">
                Backing means one of their leaders read the guide, checked the safety list and
                built it once. Their name is on it.
              </p>
              <div className="grid gap-3.5 sm:grid-cols-2">
                {guides.map((g) => {
                  const photo = safePhotoSrc(g.photo_urls?.[0] ?? null)
                  return (
                    <Link
                      key={g.id}
                      href={`/tutorials/${g.id}`}
                      className="flex gap-3.5 rounded-[var(--radius-inset)] border border-line bg-surface p-3.5 text-ink hover:shadow-[var(--shadow-e2)]"
                      style={{ boxShadow: 'var(--shadow-e1)' }}
                    >
                      <span
                        className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius-field)]"
                        style={{ background: tintFor(g.id) }}
                      >
                        {photo && <Image src={photo} alt="" fill className="object-cover" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[15px] font-extrabold">{g.title}</span>
                        <span className="mt-[3px] block text-[13px] text-muted">
                          {[
                            DIFFICULTY_LABEL[g.difficulty],
                            g.build_minutes ? formatBuildTime(g.build_minutes) : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

          {org.toysShared.length > 0 && (
            <section id="org-toys">
              <h2 className={`${H2} mb-3.5`}>
                Toys on their shelf{' '}
                <span className="text-base font-semibold text-muted">
                  {org.toysShared.length} available
                </span>
              </h2>
              <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(170px,1fr))]">
                {org.toysShared.map((t) => (
                  <ShelfToyCard key={t.id} toy={t} />
                ))}
              </div>
            </section>
          )}

          {activity.length > 0 && (
            <section id="org-activity">
              <h2 className={`${H2} mb-3.5`}>Recent activity</h2>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {activity.map((f) => (
                  <li key={f.key}>
                    <Link
                      href={f.href}
                      className="flex items-center gap-3.5 rounded-[var(--radius-inset)] border border-line bg-surface px-4 py-3.5 text-ink"
                    >
                      <span
                        aria-hidden="true"
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-field)] text-[var(--tink)]"
                        style={{ background: f.tint }}
                      >
                        <f.icon size={18} weight="bold" />
                      </span>
                      <span className="flex-1 text-sm font-semibold">{f.t}</span>
                      <span className="whitespace-nowrap text-[13px] font-bold text-muted">
                        {shortDate(f.when)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside id="org-doors" className="flex flex-col gap-4 lg:sticky lg:top-[100px]">
          {/* The board's "How to work with them": the doors are one titled
              group, not three loose rail cards. Its dek counts three doors;
              an organisation may open one, so only the clause that is true of
              every door survives. */}
          {(reach || prints || recycles) && (
            <div>
              <h2 className={H2}>How to work with them</h2>
              <p className="m-0 mt-1.5 text-sm text-muted">None of them need a referral.</p>
            </div>
          )}
          {reach && (
            <div className={`${RAIL_CARD} bg-surface`} style={{ boxShadow: 'var(--shadow-e2)' }}>
              <h3 className="m-0 font-display text-lg font-extrabold text-ink">Visit</h3>
              <dl className="m-0 grid grid-cols-[22px_1fr] items-start gap-x-2.5 gap-y-3 text-sm">
                {place && (
                  <>
                    <dt aria-label="Where" className="text-[var(--b600)]">
                      <MapPin size={18} weight="bold" aria-hidden="true" />
                    </dt>
                    <dd className="m-0 font-bold leading-[1.45] text-ink">{place}</dd>
                  </>
                )}
                {org.website_url && (
                  <>
                    <dt aria-label="Website" className="text-[var(--b600)]">
                      <Globe size={18} weight="bold" aria-hidden="true" />
                    </dt>
                    <dd className="m-0 break-all font-bold">
                      <a href={org.website_url} className="text-[var(--b700)] hover:underline">
                        {org.website_url.replace(/^https?:\/\//, '')}
                      </a>
                    </dd>
                  </>
                )}
                {org.contact_email && (
                  <>
                    <dt aria-label="Email" className="text-[var(--b600)]">
                      <EnvelopeSimple size={18} weight="bold" aria-hidden="true" />
                    </dt>
                    <dd className="m-0 break-all font-bold">
                      <a href={`mailto:${org.contact_email}`} className="text-[var(--b700)] hover:underline">
                        {org.contact_email}
                      </a>
                    </dd>
                  </>
                )}
                {org.contact_phone && (
                  <>
                    <dt aria-label="Phone" className="text-[var(--b600)]">
                      <Phone size={18} weight="bold" aria-hidden="true" />
                    </dt>
                    <dd className="m-0 font-bold text-ink">{org.contact_phone}</dd>
                  </>
                )}
              </dl>
            </div>
          )}

          {prints && (
            <div className={`${RAIL_CARD} bg-[var(--tamber)] text-[var(--tink)]`}>
              <div className="flex items-center gap-2.5">
                <Printer size={26} weight="duotone" aria-hidden="true" />
                <h3 className="m-0 font-display text-lg font-extrabold">
                  They print — you cover the filament
                </h3>
              </div>
              {org.rate_note && (
                <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-[13px]">
                  <dt className="font-semibold opacity-80">Filament</dt>
                  <dd className="m-0 font-extrabold">{org.rate_note}</dd>
                </dl>
              )}
              <p className="m-0 text-[13px] leading-[1.5]">
                Pick any guide, open its Files tab and choose {org.name} as your printer.
              </p>
              <Link
                href="/printing"
                className="inline-flex min-h-11 items-center self-start rounded-pill bg-surface px-[18px] text-sm font-extrabold text-ink"
                style={{ boxShadow: 'var(--shadow-e1)' }}
              >
                Ask them to print
              </Link>
            </div>
          )}

          {recycles && (
            // Was an inline booking form. The declaration is seven required
            // lines with a paragraph explaining why, and that does not belong
            // beside a list of guides — see components/dropoff-form.tsx. This
            // states the offer and links to the screen that takes it.
            <RecyclingCard org={org} signedIn={signedIn} />
          )}

          <div className="flex items-start gap-3 rounded-card border border-dashed border-line bg-surface px-[22px] py-[18px]">
            <Flag size={18} weight="bold" className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
            <p className="m-0 text-[13px] leading-[1.5] text-muted">
              Something wrong on this page?{' '}
              <Link href="/contact" className="font-extrabold text-[var(--b700)]">
                Report a problem
              </Link>
              . Goes to SPLAT only.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

function RecyclingCard({ org, signedIn }: { org: OrgPublicProfile; signedIn: boolean }) {
  return (
    <div className={`${RAIL_CARD} bg-[var(--tmint)] text-[var(--tink)]`}>
      <div className="flex items-center gap-2.5">
        <Recycle size={26} weight="duotone" aria-hidden="true" />
        <h3 className="m-0 font-display text-lg font-extrabold">They take waste plastic</h3>
      </div>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-[13px]">
        <dt className="font-semibold opacity-80">Polymers</dt>
        <dd className="m-0 font-extrabold">{(org.recycling_materials ?? []).join(' · ')}</dd>
      </dl>
      <p className="m-0 text-[13px] leading-[1.5]">
        {org.recycling_note ? `${org.recycling_note} ` : ''}They weigh it at the door and issue
        print credit against that weight.
      </p>
      <Link
        href={signedIn ? `/get-involved/recycling/drop-off?org=${org.id}` : '/get-involved/recycling'}
        className="inline-flex min-h-11 items-center self-start rounded-pill bg-surface px-[18px] text-sm font-extrabold text-ink"
        style={{ boxShadow: 'var(--shadow-e1)' }}
      >
        {signedIn ? 'Book a drop-off' : 'How recycling works'}
      </Link>
    </div>
  )
}
