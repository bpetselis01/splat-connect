'use client'
import { useState } from 'react'
import { TutorialCard } from '@/components/tutorial-card'
import type { Tutorial, Difficulty } from '@splat-connect/types'

const DIFFICULTIES: (Difficulty | 'all')[] = ['all', 'easy', 'medium', 'hard']

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
      <h1 className="mb-6 title-hub">
        Toy Adaptation Library
      </h1>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label htmlFor="library-search" className="sr-only">
          Search by toy name
        </label>
        <input
          id="library-search"
          type="search"
          placeholder="Search by toy name…"
          className="field field-sm min-w-48 max-w-sm flex-1"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={difficulty === d}
              onClick={() => setDifficulty(d)}
              className="chip"
            >
              {d}
            </button>
          ))}
        </div>
        <span aria-live="polite" className="text-xs font-semibold text-muted">
          {filtered.length} tutorial{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <span aria-hidden="true" className="empty-badge">
            🔍
          </span>
          <p className="mt-4 font-bold text-ink">No tutorials found.</p>
          <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
            Try a shorter search, or set the difficulty filter back to All.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
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
  )
}
