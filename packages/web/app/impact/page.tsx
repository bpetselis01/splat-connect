import {
  BookOpen,
  Buildings,
  Gift,
  Handshake,
  Package,
  UsersThree,
} from '@phosphor-icons/react/dist/ssr'
import { SplatMascot } from '@/components/splat-mascot'
import Link from 'next/link'
import type { Route } from 'next'
import { ImpactCard } from '@/components/impact-card'
import { HubGrid } from '@/components/hub-grid'
import { PUBLIC_NAV } from '@/lib/public-nav'
import type { ImpactSummary } from '@splat-connect/types'

// Same shape the empty grid/strip below already render for zero rows, so a
// fetch failure just looks like "nothing yet" rather than a separate error UI.
const EMPTY_IMPACT: ImpactSummary = {
  totals: { tutorials: 0, toysShared: 0, toysDelivered: 0, contributors: 0, organisations: 0 },
  recent: [],
  contributors: [],
  organisations: [],
}

export default async function ImpactPage() {
  const impactSection = PUBLIC_NAV.find((s) => s.href === '/impact')!
  let impact: ImpactSummary = EMPTY_IMPACT
  try {
    const res = await fetch(`${process.env.API_URL}/api/public/impact`, { cache: 'no-store' })
    if (res.ok) impact = await res.json()
  } catch {
    impact = EMPTY_IMPACT
  }

  const { totals, recent, contributors, organisations } = impact
  /*
   * The board draws these big and tinted, and it is right to: the numbers are
   * the whole point of the screen. §5's "never a 4-tile stat grid" is about
   * detail and record screens, where a grid of counts pushes the record itself
   * down the page; here the counts ARE the record.
   *
   * Five, not the board's four — this app counts organisations separately from
   * contributors, and dropping one to fit a row of four would be losing a fact
   * to a grid.
   */
  const stats = [
    { label: 'Guides', count: totals.tutorials, icon: BookOpen, tint: 'var(--b100)' },
    { label: 'Toys shared', count: totals.toysShared, icon: Package, tint: 'var(--tmint)' },
    { label: 'Toys delivered', count: totals.toysDelivered, icon: Gift, tint: 'var(--tcoral)' },
    { label: 'Contributors', count: totals.contributors, icon: UsersThree, tint: 'var(--tviolet)' },
    { label: 'Organisations', count: totals.organisations, icon: Buildings, tint: 'var(--tamber)' },
  ]

  return (
    <div>
      <div className="mb-7 grid grid-cols-1 items-center gap-6 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <p className="eyebrow text-muted">Impact</p>
          <h1 className="mt-1 title-article">What this community has made, given and delivered</h1>
          <p className="mt-2 max-w-[60ch] text-[17px] leading-relaxed text-muted">
            Guides written, toys shared, and deliveries made by the people and organisations
            behind SPLAT. Guides here are counted once they are approved and public.
          </p>
        </div>
        <div className="hidden justify-self-end sm:block">
          <SplatMascot width={120} />
        </div>
      </div>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
        {stats.map((s) => (
          <div
            key={s.label}
            data-testid={`impact-stat-${s.label.toLowerCase().replace(/\s+/g, '-')}`}
            className="flex flex-col gap-1.5 rounded-card p-[22px] text-ink shadow-[var(--shadow-e2),var(--shadow-hi)]"
            style={{ background: s.tint }}
          >
            <s.icon size={30} weight="duotone" aria-hidden="true" />
            <p className="mt-1.5 font-display text-[44px] font-extrabold leading-none tabular-nums">
              {s.count}
            </p>
            <p className="text-[15px] font-bold">{s.label}</p>
          </div>
        ))}
      </div>

      {recent.length > 0 && (
        <div className="mt-8">
          <h2 className="title-detail">Recently active</h2>
          {/* pr-2/pb-2 are the room the cards' 5px hard shadow needs: a scroll
              container clips at its padding edge, so with pr-0 the last card in
              the row lost its shadow flat against the edge at every width. */}
          <div className="mt-3 flex gap-3 overflow-x-auto pb-2 pr-2">
            {recent.map((r) => (
              <Link
                key={`${r.kind}-${r.id}`}
                // Cast: /contributors/[id] and /organizations/[id]/public are
                // built by sibling tasks, so typedRoutes doesn't know them yet.
                href={
                  (r.kind === 'person'
                    ? `/contributors/${r.id}`
                    : `/organizations/${r.id}/public`) as Route<string>
                }
                className="card card-link shrink-0 px-4 py-3"
              >
                <p className="max-w-40 truncate text-sm font-bold text-ink">{r.name}</p>
                <span
                  className={`badge mt-1 ${
                    r.kind === 'person' ? 'bg-brand-tint text-brand-deep' : 'bg-mint-soft text-ink'
                  }`}
                >
                  {r.kind === 'person' ? 'Person' : 'Organisation'}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="title-detail">Contributors and organisations</h2>
        {contributors.length === 0 && organisations.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span aria-hidden="true" className="empty-badge text-brand-deep">
  <Handshake className="h-8 w-8" />
</span>
            <p className="mt-4 font-bold text-ink">No contributors yet.</p>
            <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
              Check back soon — this page tracks guides, toys, and deliveries across the
              community.
            </p>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {contributors.map((c) => (
              <ImpactCard key={`person-${c.id}`} kind="person" entity={c} />
            ))}
            {organisations.map((o) => (
              <ImpactCard key={`org-${o.id}`} kind="org" entity={o} />
            ))}
          </div>
        )}
      </div>

      {/* The rest of the section. Organisations moved into the nav here because a
          directory of who stands behind the work is a proof surface, and it had
          nowhere in the top bar once the two catalogues were split. */}
      <div className="mt-12">
        <h2 className="title-detail">More in Impact</h2>
        <p className="mb-4 mt-1 max-w-prose text-sm text-muted">
          Some of this is not built yet. Those pages say so, and will take your email if
          you want to know when they are.
        </p>
        <HubGrid items={impactSection.children} tone={impactSection.tone} columns={4} />
      </div>
    </div>
  )
}
