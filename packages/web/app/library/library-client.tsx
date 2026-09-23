'use client'
/**
 * The guides library, as the board's #library draws it.
 *
 * Two structural things came from reading the board rather than looking at it.
 * It opens with a hero CARD, not a heading: the screen has two jobs — find a
 * guide, or write one — and a bare h1 over a filter row makes the second job a
 * footnote. And the filters live in a sticky 280px rail beside the grid rather
 * than in a row above it, which is what lets there be more than four of them
 * without pushing the first card below the fold.
 *
 * The rail is the board's three facets, one choice each (lib/library-filter.ts
 * holds the rules), and there is no search box in it: the header's search
 * submits here as ?q=, which shows as a removable chip like any other filter.
 *
 * Filtering stays client-side over the whole list. The API returns every
 * published guide in one call and there are hundreds, not millions; a round
 * trip per chip would make the rail feel broken for a saving nobody can
 * measure.
 */
import { useState } from 'react'
import type { Route } from 'next'
import {
  Books,
  HandHeart,
  Smiley,
  Sliders,
  MagnifyingGlass,
  NotePencil,
  Gift,
  X,
  SquaresFour,
  Wrench,
  Clock,
  Dog,
  CircleHalf,
  Fire,
  Timer,
  HourglassMedium,
  Cube,
  CheckCircle,
  HandTap,
} from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { TutorialCard } from '@/components/tutorial-card'
import { BrowseHero } from '@/components/browse-hero'
import { SortControl } from '@/components/sort-control'
import { SplatMascot } from '@/components/splat-mascot'
import {
  SORTS,
  filterGuides,
  sortGuides,
  type Filters,
  type SortDir,
  type SortKey,
} from '@/lib/library-filter'
import type { Tutorial } from '@splat-connect/types'

export type LibraryStats = { guides: number; contributors: number; organisations: number }

type Icon = typeof Dog
type Facet = {
  key: keyof Filters
  label: string
  Icon: Icon
  opts: { value: string; label: string; Icon: Icon }[]
}

// The board's FAC, verbatim in labels and glyphs.
const FACETS: Facet[] = [
  {
    key: 'type',
    label: 'Guide type',
    Icon: SquaresFour,
    opts: [
      { value: 'toy_adaptation', label: 'Toy adaptation guide', Icon: Dog },
      { value: 'assistive_tech', label: 'Assistive tech guide', Icon: Wrench },
    ],
  },
  {
    key: 'skill',
    label: 'Your skill level',
    Icon: Wrench,
    opts: [
      { value: 'easy', label: 'Easy', Icon: Smiley },
      { value: 'medium', label: 'Medium', Icon: CircleHalf },
      { value: 'hard', label: 'Hard', Icon: Fire },
    ],
  },
  {
    key: 'time',
    label: 'Time',
    Icon: Clock,
    opts: [
      { value: 'u30', label: 'Under 30 min', Icon: Timer },
      { value: 'u60', label: 'Under 1 hour', Icon: HourglassMedium },
      { value: 'print', label: 'Needs printing', Icon: Cube },
    ],
  },
]

export function LibraryClient({
  tutorials,
  stats,
  savedIds,
  signedIn,
  initialSearch = '',
  suits = null,
}: {
  tutorials: Tutorial[]
  stats: LibraryStats | null
  savedIds: string[]
  signedIn: boolean
  initialSearch?: string
  /** The guides that suit one of the parent's children (080), or null to say nothing. */
  suits?: { ids: string[]; name: string } | null
}) {
  // A Set rather than repeated .includes: this is the busiest page on the site
  // and the lookup runs once per card.
  const saved = new Set(savedIds)
  const [search, setSearch] = useState(initialSearch)
  const [filters, setFilters] = useState<Filters>({})
  const [sortKey, setSortKey] = useState<SortKey>('new')
  const [dir, setDir] = useState<SortDir>('desc')
  const [suitsOnly, setSuitsOnly] = useState(false)
  const suitsSet = new Set(suits?.ids ?? [])
  const suitsLabel = suits ? `Suits ${suits.name}` : ''

  // Tapping the chosen option clears it — one choice per facet, as the board has it.
  function toggle(key: keyof Filters, value: string) {
    setFilters((f) => ({ ...f, [key]: f[key] === value ? undefined : value }))
  }

  const shown = sortGuides(filterGuides(tutorials, filters, search), sortKey, dir).filter(
    (t) => !suitsOnly || suitsSet.has(t.id)
  )

  const active = [
    ...FACETS.flatMap((f) =>
      f.opts
        .filter((o) => filters[f.key] === o.value)
        .map((o) => ({ label: o.label, clear: () => toggle(f.key, o.value) }))
    ),
    ...(search ? [{ label: `“${search}”`, clear: () => setSearch('') }] : []),
    ...(suitsOnly ? [{ label: suitsLabel, clear: () => setSuitsOnly(false) }] : []),
  ]

  function clearAll() {
    setFilters({})
    setSearch('')
    setSuitsOnly(false)
  }

  // The wizard keeps a profile, which needs an account. Signing up first, with
  // the reason on screen, beats /onboarding/child's bare redirect to /login.
  const wizardHref = (
    signedIn ? '/onboarding/child' : '/signup?next=%2Fonboarding%2Fchild&reason=child'
  ) as Route

  return (
    <div className="flex flex-col gap-8">
      <BrowseHero
        eyebrow="Guides"
        title="Adapt a toy in an evening"
        lede="Step-by-step guides for switch-adapting toys and printing the parts that hold them, each one read by a reviewer before it went public. About $30 of parts and a screwdriver."
        primary={{
          label: 'Browse the guides',
          href: '#guide-grid',
          icon: <Books size={20} weight="bold" aria-hidden="true" />,
        }}
        secondary={{
          label: 'Pick for my child',
          href: wizardHref,
          icon: <Smiley size={20} weight="bold" className="text-brand-dark" aria-hidden="true" />,
        }}
        // From /api/public/tutorials/stats, over the public listing; a failed
        // fetch falls back to the one number the page can count itself.
        stats={[
          { n: stats?.guides ?? tutorials.length, label: 'reviewed guides' },
          ...(stats
            ? [
                { n: stats.contributors, label: 'contributors' },
                { n: stats.organisations, label: 'organisations backing' },
              ]
            : []),
        ]}
        aside={{
          kicker: 'Or give',
          title: 'Built one? Write it up.',
          body: 'One build, photographed as you go, becomes a guide another family can follow. An organisation or SPLAT reads it before it is published — so a rejection is never a surprise.',
          cta: {
            label: 'Submit a guide',
            href: '/get-involved/submit-a-tutorial',
            icon: <NotePencil size={18} weight="bold" aria-hidden="true" />,
          },
          art: <SplatMascot width={132} pose="think" />,
        }}
      />

      <div id="guide-grid" className="browse-layout scroll-mt-24">
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

          {suits && (
            <fieldset>
              <legend>
                <HandTap size={18} weight="duotone" className="text-brand-dark" aria-hidden="true" />
                For your child
              </legend>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={suitsOnly}
                  onClick={() => setSuitsOnly(!suitsOnly)}
                  className="chip gap-1.5"
                >
                  <CheckCircle size={14} weight="bold" className="text-brand-dark" aria-hidden="true" />
                  {suitsLabel}
                  <span className="text-muted">· {suits.ids.length}</span>
                </button>
              </div>
            </fieldset>
          )}

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
              Answer five quick questions about your child and we&apos;ll pick the guides worth your evening.
              Free account needed to keep the profile.{' '}
              <Link href={wizardHref} className="font-extrabold underline">
                Pick for my child →
              </Link>
            </span>
          </p>
          <p className="browse-note bg-mint-soft">
            <HandHeart size={26} weight="duotone" className="flex-none" aria-hidden="true" />
            <span>
              <strong className="font-extrabold">No guide for your child&apos;s toy?</strong>{' '}
              Describe the toy and the child it&apos;s for — makers pick ideas up as design
              challenges.{' '}
              <Link href="/get-involved/submit-an-idea" className="font-extrabold underline">
                Submit an idea →
              </Link>
            </span>
          </p>
        </aside>

        <div>
          <div className="browse-head">
            <h2>{suitsOnly && active.length === 1 ? suitsLabel : 'All guides'}</h2>
            <div className="flex items-center gap-2.5">
              <span aria-live="polite" className="text-sm font-bold text-muted">
                {shown.length} guide{shown.length === 1 ? '' : 's'}
              </span>
              <SortControl
                sorts={SORTS}
                label="Sort guides by"
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

          {shown.length === 0 ? (
            <div className="browse-empty">
              <span
                aria-hidden="true"
                className="grid h-[72px] w-[72px] place-items-center rounded-card bg-sunken text-muted"
              >
                <MagnifyingGlass size={36} weight="duotone" />
              </span>
              <h3 className="mb-1 mt-3 font-display text-2xl font-extrabold text-ink">
                Nothing matches all of those yet
              </h3>
              <p className="m-0 mb-4 max-w-[40ch] text-muted">
                Try removing a filter. Someone nearby may already have built it — or suggest the
                toy as an idea.
              </p>
              <div className="flex flex-wrap justify-center gap-2.5">
                <button type="button" onClick={clearAll} className="btn btn-primary">
                  Clear filters
                </button>
                <Link href="/toy-library" className="btn btn-quiet no-underline">
                  <Gift size={18} weight="bold" className="text-brand-dark" aria-hidden="true" />
                  Browse toys instead
                </Link>
                <Link href="/get-involved/submit-an-idea" className="btn btn-quiet no-underline">
                  Submit an idea
                </Link>
              </div>
            </div>
          ) : (
            <div className="browse-grid">
              {shown.map((t) => (
                <TutorialCard
                  key={t.id}
                  tutorial={t}
                  save={{ slug: 'tutorials', id: t.id, saved: saved.has(t.id), signedIn }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
