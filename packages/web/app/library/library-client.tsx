'use client'
/**
 * The library browse surface.
 *
 * A finding page, so it stays restrained: the only motion is a fade as cards
 * arrive, with no travel. Reveal's variants are fade-only here because
 * reflow.spec.ts reads two cards' boundingBox values and asserts their y offsets
 * match within 4px — translating them would make that flake.
 *
 * Three strings are matched exactly by tests/e2e/public/library.spec.ts and must
 * not drift: the "Search by toy name…" placeholder, "No tutorials found." and
 * "Try a shorter search, or set the difficulty filter back to All."
 */
import { useState } from 'react'
import { TutorialCard } from '@/components/tutorial-card'
import { Reveal } from '@/components/reveal'
import { fadeIn, stagger } from '@/lib/motion'
import { Search } from '@/components/icons'
import type { Tutorial, Difficulty } from '@splat-connect/types'

const DIFFICULTIES: (Difficulty | 'all')[] = ['all', 'easy', 'medium', 'hard']

export function LibraryClient({ tutorials }: { tutorials: Tutorial[] }) {
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty | 'all'>('all')

  const filtered = tutorials.filter((t) => {
    const matchesSearch = t.title
      .toLowerCase()
      .includes(search.toLowerCase())
    const matchesDifficulty =
      difficulty === 'all' || t.difficulty === difficulty
    return matchesSearch && matchesDifficulty
  })

  return (
    <div>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">
          Toy Adaptation Library
        </h1>
        <p className="mt-2 leading-relaxed text-muted">
          Every guide here is free. Find the toy your child already loves, and
          make it work with a switch.
        </p>
      </div>

      {/* The controls read as one instrument rather than three loose rows. */}
      <div className="mt-6 rounded-2xl border border-line bg-surface p-4">
        <label htmlFor="library-search" className="sr-only">
          Search by toy name
        </label>
        <input
          id="library-search"
          type="search"
          placeholder="Search by toy name…"
          className="field field-sm w-full"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={difficulty === d}
              onClick={() => setDifficulty(d)}
              className="chip capitalize"
            >
              {d}
            </button>
          ))}
          <span
            aria-live="polite"
            className="ml-auto text-xs font-semibold text-muted"
          >
            {filtered.length} tutorial{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <span aria-hidden="true" className="empty-badge text-brand-dark">
            <Search className="h-8 w-8" />
          </span>
          <p className="mt-4 font-bold text-ink">No tutorials found.</p>
          <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
            Try a shorter search, or set the difficulty filter back to All.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((t, i) => (
            // key includes the filter state so a re-filter re-runs the fade;
            // without it the cards that survive a filter change never move.
            <Reveal
              key={`${difficulty}:${t.id}`}
              className="h-full"
              variants={fadeIn}
              delay={stagger(i).delay as number}
            >
              <TutorialCard tutorial={t} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  )
}
