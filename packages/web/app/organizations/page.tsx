/**
 * Organisations directory.
 *
 * Exists so "Riverside Therapy backed this" is a name with something behind it —
 * for a contributor deciding who to ask, and for a parent reading a badge.
 *
 * Suspended organisations are listed and marked rather than hidden: one vanishing
 * from a directory is unexplainable to someone who expected to find it, and their
 * name is still on work they already backed.
 *
 * Related files:
 * - packages/api/src/routes/public.ts: GET /api/public/organizations
 * - app/organizations/[id]/page.tsx: one organisation, plus its leader's workspace
 * - components/edit-backing-section.tsx: where a contributor acts on this
 */
import { Buildings, MagnifyingGlass, Recycle, SquaresFour } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import type { Route } from 'next'
import type { Organization } from '@splat-connect/types'

/** The board cycles its directory bands through the tint set rather than
 *  giving every organisation the same blue. */
const BAND_TINTS = ['var(--b100)', 'var(--tmint)', 'var(--tamber)', 'var(--tviolet)', 'var(--tcoral)']

/** Two letters, the way the board's avatars and its directory bands both do it. */
function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; f?: string }>
} = {}) {
  const { q = '', f = '' } = (await searchParams) ?? {}
  let orgs: Organization[] = []
  try {
    const res = await fetch(`${process.env.API_URL}/api/public/organizations`, {
      cache: 'no-store',
    })
    if (res.ok) orgs = await res.json()
  } catch {
    orgs = []
  }

  if (orgs.length === 0) {
    return (
      <div>
        <h1 className="mb-4 title-hub">Organisations</h1>
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <span aria-hidden="true" className="empty-badge text-brand-deep">
  <Buildings className="h-8 w-8" />
</span>
          <p className="mt-4 font-bold text-ink">No organisations yet.</p>
          <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
            Organisations are set up by SPLAT. Once one exists, you can ask it to
            back a project when you submit.
          </p>
        </div>
      </div>
    )
  }

  // The board's filter row, less the three it has no data for yet — who has
  // a printer, who holds toys, and distance. A control that filters nothing
  // is worse than one that is not there.
  const needle = q.trim().toLowerCase()
  const shown = orgs.filter(
    (o) =>
      (!needle || o.name.toLowerCase().includes(needle)) &&
      (f !== 'plastic' || (o.recycling_materials?.length ?? 0) > 0)
  )
  const filterHref = (value: string) => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (value) p.set('f', value)
    const qs = p.toString()
    return (qs ? `/organizations?${qs}` : '/organizations') as Route
  }

  return (
    <div>
      <span className="text-[13px] font-extrabold uppercase tracking-[0.1em] text-[var(--violet)]">
        Impact
      </span>
      <h1 className="mt-2.5 font-display text-[clamp(32px,3.6vw,46px)] font-extrabold leading-[1.08] tracking-[-0.02em] text-ink">
        Organisations
      </h1>
      <p className="mt-3 max-w-[62ch] text-lg leading-[1.6] text-muted">
        The therapy centres, schools and services standing behind the work. An
        organisation&apos;s name on a guide means one of its leaders read it and vouched for
        it.
      </p>

      <div className="mb-[22px] mt-[26px] flex flex-wrap gap-2.5">
        <form action="/organizations" className="relative flex items-center">
          <MagnifyingGlass size={16} className="pointer-events-none absolute left-3.5 text-muted" aria-hidden="true" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search organisations"
            aria-label="Search organisations"
            className="h-11 w-[280px] max-w-full rounded-pill border border-line bg-surface pl-10 pr-3.5 text-[15px] font-medium text-ink"
            style={{ boxShadow: 'var(--shadow-e1)' }}
          />
          {f && <input type="hidden" name="f" value={f} />}
        </form>
        {[
          { value: '', label: 'All', icon: SquaresFour },
          { value: 'plastic', label: 'Takes plastic', icon: Recycle },
        ].map((x) => {
          const on = f === x.value
          return (
            <Link
              key={x.label}
              href={filterHref(x.value)}
              aria-pressed={on}
              className={`inline-flex min-h-11 items-center gap-2 rounded-pill border px-4 text-sm font-bold ${
                on ? 'border-[var(--b600)] bg-[var(--b600)] text-[var(--onbrand)]' : 'border-line bg-surface text-ink'
              }`}
            >
              <x.icon size={14} weight="bold" aria-hidden="true" />
              {x.label}
            </Link>
          )
        })}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-card border border-dashed border-line bg-surface p-8 text-center text-[15px] text-muted">
          No organisation matches that yet. Try another filter.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((org, i) => {
            const place = [org.suburb, org.state].filter(Boolean).join(', ')
            return (
              <Link
                key={org.id}
                href={`/organizations/${org.id}/public`}
                className="card card-link flex flex-col overflow-hidden"
              >
                <span
                  aria-hidden="true"
                  className="grid aspect-[16/7] place-items-center font-display text-[34px] font-extrabold opacity-75"
                  style={{ background: BAND_TINTS[i % BAND_TINTS.length], color: 'var(--tink)' }}
                >
                  {initials(org.name)}
                </span>
                <span className="flex flex-1 flex-col px-5 pb-5 pt-[18px]">
                  <span className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className="font-display text-lg font-extrabold text-ink">{org.name}</span>
                    {org.status === 'suspended' && (
                      <span className="badge bg-sunken text-muted">SUSPENDED</span>
                    )}
                    {(org.recycling_materials?.length ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-pill bg-[var(--tmint)] px-2.5 py-[3px] text-[11px] font-extrabold text-[var(--tink)]">
                        <Recycle size={12} weight="fill" aria-hidden="true" />
                        Takes plastic
                      </span>
                    )}
                  </span>
                  {place && (
                    <span className="mb-2.5 block text-[13px] font-semibold text-muted">{place}</span>
                  )}
                  {org.description && (
                    <span className="line-clamp-2 text-[13px] font-semibold leading-relaxed text-muted">
                      {org.description}
                    </span>
                  )}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
