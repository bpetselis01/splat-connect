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
 * Filtering stays client-side over the whole list. The API returns every
 * published guide in one call and there are hundreds, not millions; a round
 * trip per chip would make the rail feel broken for a saving nobody can
 * measure.
 */
import { useState } from 'react'
import {
  Books,
  HandHeart,
  Lightning,
  Smiley,
  Sliders,
  MagnifyingGlass,
  NotePencil,
  Gift,
  X,
} from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { TutorialCard } from '@/components/tutorial-card'
import { BrowseHero } from '@/components/browse-hero'
import { SplatMascot } from '@/components/splat-mascot'
import { KIND_LABEL, type Tutorial, type Difficulty, type TutorialKind } from '@splat-connect/types'

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']
const KINDS: TutorialKind[] = ['toy_adaptation', 'assistive_tech']

/** A facet option: a 44px pill that presses in when it is on. */
function Facet({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className="chip">
      {children}
    </button>
  )
}

export function LibraryClient({
  tutorials,
  savedIds,
  signedIn,
}: {
  tutorials: Tutorial[]
  savedIds: string[]
  signedIn: boolean
}) {
  // A Set rather than repeated .includes: this is the busiest page on the site
  // and the lookup runs once per card.
  const saved = new Set(savedIds)
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty[]>([])
  const [kinds, setKinds] = useState<TutorialKind[]>([])

  function toggle<T>(list: T[], set: (v: T[]) => void, value: T) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  }

  const filtered = tutorials.filter((t) => {
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase())
    // An empty facet means "any", not "none" — the board's Clear puts every
    // facet back to empty and expects the full list, so the two must agree.
    const matchesDifficulty = difficulty.length === 0 || difficulty.includes(t.difficulty)
    const matchesKind = kinds.length === 0 || kinds.includes(t.kind)
    return matchesSearch && matchesDifficulty && matchesKind
  })

  const backed = tutorials.filter((t) =>
    (t.tutorial_orgs ?? []).some((b) => b.status === 'accepted')
  ).length
  const beginner = tutorials.filter((t) => t.difficulty === 'easy').length

  const active = [
    ...difficulty.map((d) => ({
      label: d[0].toUpperCase() + d.slice(1),
      clear: () => toggle(difficulty, setDifficulty, d),
    })),
    ...kinds.map((k) => ({ label: KIND_LABEL[k], clear: () => toggle(kinds, setKinds, k) })),
    ...(search ? [{ label: `“${search}”`, clear: () => setSearch('') }] : []),
  ]

  function clearAll() {
    setDifficulty([])
    setKinds([])
    setSearch('')
  }

  return (
    <div className="flex flex-col gap-8">
      <BrowseHero
        eyebrow="Guides"
        title="Adapt a toy in an evening"
        lede="Step-by-step guides for switch-adapting toys and printing the parts that hold them, each one read by a reviewer before it went public."
        primary={{
          label: 'Browse the guides',
          href: '#guide-grid',
          icon: <Books size={20} weight="bold" aria-hidden="true" />,
        }}
        secondary={{
          label: 'Pick for my child',
          href: '/learn/choosing-a-toy',
          icon: <Smiley size={20} weight="bold" className="text-brand-dark" aria-hidden="true" />,
        }}
        stats={[
          { n: tutorials.length, label: 'guides published' },
          { n: beginner, label: 'an evening or less' },
          { n: backed, label: 'backed by a service' },
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
          art: <SplatMascot width={84} />,
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

          <div>
            <label htmlFor="library-search" className="mb-2.5 block text-sm font-extrabold text-ink">
              Search
            </label>
            <input
              id="library-search"
              type="search"
              placeholder="Toy or guide name…"
              className="field w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <fieldset>
            <legend>
              <Lightning size={18} weight="duotone" className="text-brand-dark" aria-hidden="true" />
              How hard
            </legend>
            <div className="flex flex-wrap gap-2">
              {DIFFICULTIES.map((d) => (
                <Facet
                  key={d}
                  on={difficulty.includes(d)}
                  onClick={() => toggle(difficulty, setDifficulty, d)}
                >
                  <span className="capitalize">{d}</span>
                </Facet>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>
              <Books size={18} weight="duotone" className="text-brand-dark" aria-hidden="true" />
              What kind
            </legend>
            <div className="flex flex-wrap gap-2">
              {KINDS.map((k) => (
                <Facet key={k} on={kinds.includes(k)} onClick={() => toggle(kinds, setKinds, k)}>
                  {KIND_LABEL[k]}
                </Facet>
              ))}
            </div>
          </fieldset>

          <p className="browse-note bg-honey-soft">
            <Sliders size={26} weight="duotone" className="flex-none" aria-hidden="true" />
            <span>
              <strong className="font-extrabold">Not sure what to filter by?</strong> The course
              walks through what suits your child.{' '}
              <Link href="/learn" className="font-extrabold underline">
                Start with Learn →
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
            <h2>All guides</h2>
            <span aria-live="polite" className="text-sm font-bold text-muted">
              {filtered.length} guide{filtered.length === 1 ? '' : 's'}
            </span>
          </div>

          {active.length > 0 && (
            <div className="mb-5 flex min-h-9 flex-wrap gap-2">
              {active.map((chip) => (
                <button key={chip.label} type="button" onClick={chip.clear} className="browse-chip">
                  {chip.label}
                  <X size={14} weight="bold" className="p-1" aria-label="Remove filter" />
                </button>
              ))}
            </div>
          )}

          {filtered.length === 0 ? (
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
              {filtered.map((t) => (
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
