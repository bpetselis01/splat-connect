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
import { BrowseFilters } from '@/components/browse-filters'
import { useShowMore, ShowMoreButton } from '@/components/show-more'
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
  ArrowsDownUp,
  Wrench,
  Clock,
  CircleHalf,
  Fire,
  Timer,
  HourglassMedium,
  Cube,
  UserCircle,
  Package,
} from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { TutorialCard } from '@/components/tutorial-card'
import { BrowseHero } from '@/components/browse-hero'
import { SplatMascot } from '@/components/splat-mascot'
import {
  SORTS,
  filterGuides,
  sortGuides,
  type Filters,
  type SortKey,
} from '@/lib/library-filter'
import {
  ACCESS,
  CHILD_QUESTIONS,
  DEVICE_TYPES,
  NO_SUITS_FILTER,
  ONE_HAND_LABEL,
  type ChildTags,
  type SuitsFilter,
  type Tutorial,
} from '@splat-connect/types'
import { authUrl } from '@/lib/safe-next-path'

export type LibraryStats = { guides: number; contributors: number; organisations: number }

type Icon = typeof Wrench
type Facet = {
  key: keyof Filters
  label: string
  Icon: Icon
  opts: { value: string; label: string; Icon: Icon }[]
}

// The board's FAC, verbatim in labels and glyphs.
const FACETS: Facet[] = [
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

type TagKey = Exclude<keyof SuitsFilter, 'one_hand'>
/** The tag questions as chips: the four child ones, then the guide's device type. "One hand is enough" rides in the access group as its own chip. */
const CHILD_GROUPS: { key: TagKey; label: string; options: readonly { value: string; label: string }[] }[] =
  CHILD_QUESTIONS.map((q) => ({
    key: q.item,
    label: q.label,
    options: q.item === 'access' ? [...ACCESS, { value: 'one_hand', label: ONE_HAND_LABEL }] : q.options,
  }))
const GUIDE_GROUPS: typeof CHILD_GROUPS = [{ key: 'device_types', label: 'Device type', options: DEVICE_TYPES }]

export function LibraryClient({
  tutorials,
  stats,
  savedIds,
  signedIn,
  initialSearch = '',
  child = null,
}: {
  tutorials: Tutorial[]
  stats: LibraryStats | null
  savedIds: string[]
  signedIn: boolean
  initialSearch?: string
  /** The signed-in parent's first child: Recommended puts their matches first. */
  child?: ChildTags | null
}) {
  // A Set rather than repeated .includes: this is the busiest page on the site
  // and the lookup runs once per card.
  const saved = new Set(savedIds)
  const [search, setSearch] = useState(initialSearch)
  const [filters, setFilters] = useState<Filters>({})
  const [sortKey, setSortKey] = useState<SortKey>('recommended')
  const suits = filters.suits ?? NO_SUITS_FILTER

  // Tapping the chosen option clears it — one choice per facet, as the board has it.
  function toggle(key: keyof Filters, value: string) {
    setFilters((f) => ({ ...f, [key]: f[key] === value ? undefined : value }))
  }

  const chosen = (key: TagKey, value: string) =>
    value === 'one_hand' ? suits.one_hand : (suits[key] as string[]).includes(value)

  // Any number of choices per tag group.
  function toggleTag(key: TagKey, value: string) {
    const next: SuitsFilter =
      value === 'one_hand'
        ? { ...suits, one_hand: !suits.one_hand }
        : {
            ...suits,
            [key]: chosen(key, value) ? (suits[key] as string[]).filter((v) => v !== value) : [...suits[key], value],
          }
    setFilters((f) => ({ ...f, suits: next }))
  }

  const shown = sortGuides(filterGuides(tutorials, filters, search), sortKey, child)
  const { limit, more } = useShowMore(JSON.stringify([filters, search, sortKey]))

  const active = [
    ...FACETS.flatMap((f) =>
      f.opts
        .filter((o) => filters[f.key] === o.value)
        .map((o) => ({ label: o.label, clear: () => toggle(f.key, o.value) }))
    ),
    ...[...CHILD_GROUPS, ...GUIDE_GROUPS].flatMap((g) =>
      g.options
        .filter((o) => chosen(g.key, o.value))
        .map((o) => ({ label: o.label, clear: () => toggleTag(g.key, o.value) }))
    ),
    ...(search ? [{ label: `“${search}”`, clear: () => setSearch('') }] : []),
  ]

  function clearAll() {
    setFilters({})
    setSearch('')
  }

  // The wizard keeps a profile, which needs an account. Signing up first, with
  // the reason on screen, beats /onboarding/child's bare redirect to /login.
  const wizardHref = (
    signedIn ? '/onboarding/child' : authUrl('signup', '/onboarding/child', { reason: 'child' })
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
        <BrowseFilters onClear={clearAll}>

          <fieldset>
            <legend>
              <ArrowsDownUp size={18} weight="duotone" className="text-brand-dark" aria-hidden="true" />
              Sort by
            </legend>
            <div className="flex flex-wrap gap-2">
              {SORTS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  aria-pressed={sortKey === o.key}
                  onClick={() => setSortKey(o.key)}
                  className="chip"
                >
                  {o.label}
                </button>
              ))}
            </div>
          </fieldset>

          <h3 className="m-0 flex items-center gap-1.5 font-display text-base font-extrabold text-ink">
            <UserCircle size={18} weight="duotone" className="text-brand-dark" aria-hidden="true" />
            About your child
          </h3>
          {CHILD_GROUPS.map((g) => (
            <TagGroup key={g.key} group={g} chosen={chosen} onToggle={toggleTag} />
          ))}

          <h3 className="m-0 flex items-center gap-1.5 font-display text-base font-extrabold text-ink">
            <Package size={18} weight="duotone" className="text-brand-dark" aria-hidden="true" />
            About the guide
          </h3>
          {GUIDE_GROUPS.map((g) => (
            <TagGroup key={g.key} group={g} chosen={chosen} onToggle={toggleTag} />
          ))}

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
        </BrowseFilters>

        <div>
          <div className="browse-head">
            <h2>All guides</h2>
            <span aria-live="polite" className="text-sm font-bold text-muted">
              {shown.length} guide{shown.length === 1 ? '' : 's'}
            </span>
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
              {shown.slice(0, limit).map((t) => (
                <TutorialCard
                  key={t.id}
                  tutorial={t}
                  save={{ slug: 'tutorials', id: t.id, saved: saved.has(t.id), signedIn }}
                />
              ))}
            </div>
          )}
          <ShowMoreButton
            shown={Math.min(limit, shown.length)}
            total={shown.length}
            noun="guides"
            onMore={more}
          />
        </div>
      </div>
    </div>
  )
}

function TagGroup({
  group,
  chosen,
  onToggle,
}: {
  group: (typeof CHILD_GROUPS)[number]
  chosen: (key: TagKey, value: string) => boolean
  onToggle: (key: TagKey, value: string) => void
}) {
  return (
    <fieldset>
      <legend>{group.label}</legend>
      <div className="flex flex-wrap gap-2">
        {group.options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={chosen(group.key, o.value)}
            onClick={() => onToggle(group.key, o.value)}
            className="chip"
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
