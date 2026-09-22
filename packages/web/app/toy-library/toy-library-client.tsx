'use client'
/**
 * The toy library, in the same shape as /library — because the board gives it
 * the same shape: hero card, sticky 280px filter rail, card grid.
 *
 * The two screens are deliberately not a shared component. They filter on
 * different things, their asides say opposite things ("Built one? Write it up"
 * against "Outgrown it? Pass it on"), and the one piece that IS common — the
 * hero card — is components/browse-hero.tsx. Sharing the rest would mean a
 * props object describing every difference, which is the same code with a
 * layer of indirection over it.
 */
import { useState } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import {
  ArrowsLeftRight,
  Books,
  Buildings,
  Gift,
  Hammer,
  HandHeart,
  HouseLine,
  Sliders,
  Smiley,
  UsersThree,
  X,
} from '@phosphor-icons/react/dist/ssr'
import { ToyLibraryCard } from '@/components/toy-library-card'
import { BrowseHero } from '@/components/browse-hero'
import { SplatMascot } from '@/components/splat-mascot'
import { SortControl, type SortDir, type SortOption } from '@/components/sort-control'
import type { ToyWithOwner } from '@splat-connect/types'

type Icon = typeof Gift
type FacetKey = 'offer' | 'holder'
type Facet = { key: FacetKey; label: string; Icon: Icon; opts: { value: string; label: string; Icon: Icon }[] }

/*
 * The board's TFAC, less the two facets this data cannot answer: Availability
 * (/api/public/toys only ever returns what is up for grabs) and Distance
 * (neither a toy nor a visitor has a location).
 */
const FACETS: Facet[] = [
  {
    key: 'offer',
    label: 'How it is offered',
    Icon: HandHeart,
    opts: [
      { value: 'donation', label: 'Gift', Icon: Gift },
      { value: 'exchange', label: 'Swap only', Icon: ArrowsLeftRight },
      { value: 'both', label: 'Swap or gift', Icon: HandHeart },
    ],
  },
  {
    key: 'holder',
    label: 'Who is holding it',
    Icon: UsersThree,
    opts: [
      { value: 'family', label: 'A family', Icon: HouseLine },
      { value: 'org', label: 'An organisation', Icon: Buildings },
    ],
  },
]

type ToySort = 'new' | 'cond'
// The board's TSORT without "Distance", for the same reason as the facets.
const SORTS: (SortOption<ToySort> & { dir: SortDir })[] = [
  { key: 'new', label: 'Recently listed', hint: 'Newest ↔ oldest', dir: 'desc', labels: ['Oldest first', 'Newest first'] },
  { key: 'cond', label: 'Condition', hint: 'Like new ↔ needs a fix', dir: 'desc', labels: ['Needs a fix first', 'Like new first'] },
]

function matches(t: ToyWithOwner, key: FacetKey, value: string): boolean {
  if (key === 'holder') return value === 'org' ? Boolean(t.owner_org_id) : !t.owner_org_id
  // A toy offered either way is a gift to somebody after a gift, and a swap to
  // somebody after a swap; "Swap or gift" asks for the ones open to both.
  return value === 'both' ? t.offer_type === 'both' : t.offer_type === value || t.offer_type === 'both'
}

export function ToyLibraryClient({
  toys,
  delivered = null,
  savedIds,
  signedIn,
}: {
  toys: ToyWithOwner[]
  /** All-time handovers from /api/public/impact; null when it could not be read. */
  delivered?: number | null
  savedIds: string[]
  signedIn: boolean
}) {
  // A Set rather than repeated .includes: the lookup runs once per card.
  const saved = new Set(savedIds)
  const [filters, setFilters] = useState<Partial<Record<FacetKey, string>>>({})
  const [sortKey, setSortKey] = useState<ToySort>('new')
  const [dir, setDir] = useState<SortDir>('desc')

  // Tapping the chosen option clears it — one choice per facet, as the board has it.
  function toggle(key: FacetKey, value: string) {
    setFilters((f) => ({ ...f, [key]: f[key] === value ? undefined : value }))
  }

  const sign = dir === 'asc' ? 1 : -1
  const filtered = toys
    .filter((t) => FACETS.every((f) => !filters[f.key] || matches(t, f.key, filters[f.key]!)))
    .sort((a, b) =>
      sortKey === 'cond'
        ? sign * (a.condition - b.condition)
        : sign * a.created_at.localeCompare(b.created_at)
    )

  const adapted = toys.filter((t) => t.switch_adapted).length
  const fromOrgs = toys.filter((t) => t.owner_org_id).length

  const active = FACETS.flatMap((f) =>
    f.opts
      .filter((o) => filters[f.key] === o.value)
      .map((o) => ({ label: o.label, clear: () => toggle(f.key, o.value) }))
  )

  function clearAll() {
    setFilters({})
  }

  // The wizard keeps a profile, which needs an account. Same detour /library
  // takes, for the same reason: signing up first, with the reason on screen,
  // beats /onboarding/child's bare redirect to /login.
  const wizardHref = (
    signedIn ? '/onboarding/child' : '/signup?next=%2Fonboarding%2Fchild&reason=child'
  ) as Route

  return (
    <div className="flex flex-col gap-8">
      <BrowseHero
        eyebrow="Toy Library"
        title="Adapted toys, ready to go home"
        lede="Families and organisations give these away. Request one, agree a pickup in chat, confirm the handoff with a six-digit code. Nobody’s address is ever shown."
        primary={{
          label: 'Browse the toys',
          href: '#toy-grid',
          icon: <Gift size={20} weight="bold" aria-hidden="true" />,
        }}
        secondary={{
          label: 'Pick for my child',
          href: '/learn/choosing-a-toy',
          icon: <Smiley size={20} weight="bold" className="text-brand-dark" aria-hidden="true" />,
        }}
        stats={[
          delivered != null
            ? { n: delivered, label: 'toys delivered' }
            : { n: adapted, label: 'already switch-adapted' },
          // The public list only ever holds what is up for grabs.
          { n: toys.length, label: 'available now' },
          { n: fromOrgs, label: 'held by a service' },
        ]}
        aside={{
          kicker: 'Or give',
          title: 'Outgrown it? Pass it on.',
          body: 'List a toy your child has finished with, give it away or swap it. You agree the pickup; we keep the record and the codes. Organisations can hold stock for their families too.',
          cta: {
            label: 'Give a toy',
            href: '/dashboard/toys/new',
            icon: <HandHeart size={18} weight="bold" aria-hidden="true" />,
          },
          art: <SplatMascot width={132} pose="party" />,
          tint: 'var(--color-mint-soft)',
        }}
      />

      <div id="toy-grid" className="browse-layout scroll-mt-24">
        <aside aria-label="Filters" className="browse-filters">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-extrabold text-ink">Filters</h2>
            <button
              type="button"
              onClick={clearAll}
              className="min-h-9 text-sm font-bold text-brand-deep"
            >
              Clear
            </button>
          </div>

          {FACETS.map((f) => (
            <fieldset key={f.key}>
              <legend>
                <f.Icon size={18} weight="duotone" className="text-brand-dark" aria-hidden="true" />
                {f.label}
              </legend>
              <div className="flex flex-wrap gap-2">
                {f.opts.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={filters[f.key] === o.value}
                    onClick={() => toggle(f.key, o.value)}
                    className="chip gap-1.5"
                  >
                    <o.Icon size={14} weight="bold" className="text-brand-dark" aria-hidden="true" />
                    {o.label}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}

          <p className="browse-note bg-honey-soft">
            <Sliders size={26} weight="duotone" className="flex-none" aria-hidden="true" />
            <span>
              <strong className="font-extrabold">Not sure what to filter by?</strong>{' '}
              Answer five quick questions about your child and we&apos;ll show only the toys that
              suit how they play. Free account needed to keep the profile.{' '}
              <Link href={wizardHref} className="font-extrabold underline">
                Pick for my child →
              </Link>
            </span>
          </p>
          <p className="browse-note bg-mint-soft">
            <HandHeart size={26} weight="duotone" className="flex-none" aria-hidden="true" />
            <span>
              <strong className="font-extrabold">Nothing suitable nearby?</strong> Pick a guide for
              it, then tap <em>Get help with this build</em> — a build day, printed parts or a
              maker, whichever you need.{' '}
              <Link href="/library" className="font-extrabold underline">
                Find a guide →
              </Link>
            </span>
          </p>
        </aside>

        <div>
          <div className="browse-head">
            <h2>All toys</h2>
            <div className="flex items-center gap-2.5">
              <span aria-live="polite" className="text-sm font-bold text-muted">
                {filtered.length} toy{filtered.length === 1 ? '' : 's'}
              </span>
              <SortControl
                sorts={SORTS}
                label="Sort toys by"
                sortKey={sortKey}
                dir={dir}
                onPick={(key) => {
                  setSortKey(key)
                  setDir(SORTS.find((s) => s.key === key)!.dir)
                }}
                onFlip={() => setDir(dir === 'asc' ? 'desc' : 'asc')}
              />
            </div>
          </div>

          {/* Always drawn, as on the board: the row holds its 36px when empty
              so choosing a filter does not shove the grid down. */}
          <div className="mb-5 flex min-h-9 flex-wrap gap-2">
            {active.map((chip) => (
              <button key={chip.label} type="button" onClick={chip.clear} className="browse-chip">
                {chip.label}
                <X size={14} weight="bold" className="p-1" aria-label="Remove filter" />
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="browse-empty">
              <SplatMascot width={56} pose="think" />
              <h3 className="mb-1 mt-3 font-display text-2xl font-extrabold text-ink">
                No toys match all of those
              </h3>
              <p className="m-0 mb-4 max-w-[40ch] text-muted">
                Try removing a filter — or build it yourself from a guide.
              </p>
              <div className="flex flex-wrap justify-center gap-2.5">
                <button type="button" onClick={clearAll} className="btn btn-primary">
                  Clear filters
                </button>
                <Link href="/library" className="btn btn-quiet no-underline">
                  <Books size={18} weight="bold" className="text-brand-dark" aria-hidden="true" />
                  Browse guides instead
                </Link>
                <Link href="/get-involved/makers-wanted" className="btn btn-quiet no-underline">
                  <Hammer size={18} weight="bold" className="text-brand-dark" aria-hidden="true" />
                  Ask a maker to build one
                </Link>
              </div>
            </div>
          ) : (
            <div className="browse-grid">
              {filtered.map((t) => (
                <ToyLibraryCard
                  key={t.id}
                  toy={t}
                  // /api/public/toys hides every unavailable toy.
                  available
                  save={{ slug: 'toys', id: t.id, saved: saved.has(t.id), signedIn }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
