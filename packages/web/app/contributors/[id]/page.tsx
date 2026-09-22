/**
 * A contributor's public profile, in the board's shape: a header card with the
 * numbers along its foot, a jump row, and the work underneath.
 *
 * Only what the public contributor endpoint returns is drawn. The board also
 * has a headline and bio, place, "leader at", badges, a builds heatmap, a
 * featured guide and notes from families — none of which the endpoint carries
 * yet. The activity feed is built from the guides and toys already returned.
 */
import Image from 'next/image'
import Link from 'next/link'
import type { Route } from 'next'
import { notFound } from 'next/navigation'
import { BookOpen, CaretRight, Gift, Hammer } from '@phosphor-icons/react/dist/ssr'
import { initials } from '@/components/story-bits'
import { ShelfToyCard } from '@/components/shelf-toy-card'
import { tintFor } from '@/components/card-photo'
import { getCapabilities } from '@/lib/capabilities'
import { safePhotoSrc } from '@/lib/photo-src'
import { shortDate } from '@/lib/dates'
import { formatBuildTime, type ContributorProfile } from '@splat-connect/types'

const DIFFICULTY_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' } as const
const H2 = 'font-display text-2xl font-extrabold text-ink'

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
  const first = contributor.name.split(' ')[0]
  const signedIn = !!(await getCapabilities())
  const tint = tintFor(contributor.id)
  const toys = [...contributor.toysShared, ...contributor.toysDelivered]

  const stats = [
    { n: contributor.tutorials.length, label: 'guides published', id: 'tutorials' },
    { n: contributor.toysShared.length, label: 'toys shared', id: 'toys-shared' },
    { n: contributor.toysDelivered.length, label: 'toys delivered', id: 'toys-delivered' },
  ]
  // The board's "Recent activity", newest first, off the two collections this
  // page already holds. A delivered toy has no date here — the handoff's own
  // timestamp stays on toy_transactions, which the endpoint does not return —
  // so a delivery is not a feed entry.
  const activity = [
    ...contributor.tutorials.map((t) => ({
      key: `t-${t.id}`,
      icon: BookOpen,
      tint: 'var(--b100)',
      t: `Published a guide — ${t.title}`,
      when: t.reviewed_at ?? t.created_at,
      href: `/tutorials/${t.id}` as Route,
    })),
    ...contributor.toysShared.map((t) => ({
      key: `y-${t.id}`,
      icon: Gift,
      tint: 'var(--tmint)',
      t: `Put a toy on the shelf — ${t.name}`,
      when: t.created_at,
      href: `/toy-library/${t.id}` as Route,
    })),
  ].sort((a, b) => (a.when < b.when ? 1 : -1))

  const jumps = [
    { to: 'ctb-guides', label: 'Guides', show: contributor.tutorials.length > 0 },
    { to: 'ctb-toys', label: 'Toys', show: toys.length > 0 },
    { to: 'ctb-activity', label: 'Activity', show: activity.length > 0 },
  ].filter((j) => j.show)

  // The only way to ask one person for a build. 057 gates that on the maker
  // having a public profile, and this page IS the public profile — there is no
  // directory of every account to ask from, which would be a spam surface
  // nobody asked for. Signed out it routes to signup.
  const askHref = (
    signedIn
      ? `/get-involved/requests/new?maker=${id}`
      : '/signup?next=' + encodeURIComponent(`/get-involved/requests/new?maker=${id}`)
  ) as Route

  return (
    <div>
      <nav
        aria-label="Breadcrumb"
        className="mb-[18px] flex items-center gap-2 text-sm font-bold text-muted"
      >
        <Link href="/impact" className="text-[var(--b700)]">
          Impact
        </Link>
        <CaretRight size={12} weight="bold" aria-hidden="true" />
        <span className="text-ink">{contributor.name}</span>
      </nav>

      <div
        className="overflow-hidden rounded-card border border-line bg-surface"
        style={{ boxShadow: 'var(--shadow-e3), var(--shadow-hi)' }}
      >
        <div aria-hidden="true" className="relative h-[150px] overflow-hidden" style={{ background: tint }}>
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(color-mix(in srgb, var(--b600) 18%, transparent) 1.6px, transparent 1.6px)',
              backgroundSize: '22px 22px',
              maskImage: 'linear-gradient(90deg, #000 30%, transparent 90%)',
            }}
          />
        </div>
        <div className="flex flex-wrap items-start gap-x-6 gap-y-[22px] px-8 pb-[26px]">
          <span
            aria-hidden="true"
            className="-mt-[52px] grid h-[120px] w-[120px] shrink-0 place-items-center rounded-full border-4 border-surface font-display text-4xl font-extrabold text-[var(--tink)]"
            style={{ background: tint, boxShadow: 'var(--shadow-e3)' }}
          >
            {initials(contributor.name)}
          </span>
          <div className="min-w-0 flex-[1_1_340px] pt-[18px]">
            <h1 className="font-display text-[clamp(28px,3vw,38px)] font-extrabold leading-[1.1] tracking-[-0.02em] text-ink">
              {contributor.name}
            </h1>
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2.5 pt-[18px]">
            <Link href={askHref} className="btn btn-primary no-underline">
              <Hammer size={18} weight="bold" aria-hidden="true" />
              Ask {first} to build a guide
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-3 border-t border-line">
          {stats.map((k) => (
            <div
              key={k.id}
              data-testid={`contributor-stat-${k.id}`}
              className="min-w-0 border-r border-line px-6 py-[18px] last:border-r-0"
            >
              <p className="m-0 font-display text-[30px] font-extrabold leading-none tracking-[-0.02em] tabular-nums text-ink">
                {k.n}
              </p>
              <p className="mt-1.5 text-[13px] font-bold text-muted">{k.label}</p>
            </div>
          ))}
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

      <div className="mt-7 flex min-w-0 flex-col gap-10">
        <section id="ctb-guides">
          <h2 className={`${H2} mb-3.5`}>
            Published guides{' '}
            <span className="text-base font-semibold text-muted">{contributor.tutorials.length}</span>
          </h2>
          {contributor.tutorials.length === 0 ? (
            <p className="text-sm text-muted">No guides yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {contributor.tutorials.map((g) => {
                const photo = safePhotoSrc(g.photo_urls?.[0] ?? null)
                return (
                  <Link
                    key={g.id}
                    href={`/tutorials/${g.id}`}
                    className="card card-link overflow-hidden rounded-[var(--radius-inset)] text-ink"
                    style={{ boxShadow: 'var(--shadow-e1)' }}
                  >
                    <span className="relative block h-[110px]" style={{ background: tintFor(g.id) }}>
                      {photo && <Image src={photo} alt="" fill className="object-cover" />}
                      <span className="absolute left-2.5 top-2.5 rounded-pill bg-surface px-[9px] py-[3px] text-[11px] font-extrabold">
                        {DIFFICULTY_LABEL[g.difficulty]}
                      </span>
                    </span>
                    <span className="block px-3.5 pb-3.5 pt-3">
                      <span className="block text-[15px] font-extrabold leading-[1.3]">{g.title}</span>
                      {g.build_minutes ? (
                        <span className="mt-1 block text-xs font-bold text-muted">
                          {formatBuildTime(g.build_minutes)}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {toys.length > 0 && (
          <section id="ctb-toys">
            <h2 className={`${H2} mb-3.5`}>
              Toys given{' '}
              <span className="text-base font-semibold text-muted">
                {contributor.toysShared.length} on the shelf · {contributor.toysDelivered.length}{' '}
                delivered
              </span>
            </h2>
            <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(170px,1fr))]">
              {toys.map((t) => (
                <ShelfToyCard key={t.id} toy={t} />
              ))}
            </div>
          </section>
        )}

        {activity.length > 0 && (
          <section id="ctb-activity">
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
    </div>
  )
}
