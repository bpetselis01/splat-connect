'use client'
import { useState } from 'react'
import { TutorialCard } from '@/components/tutorial-card'
import type { Tutorial, Difficulty } from '@/lib/types'

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
      <h1 className="text-3xl font-bold mb-6">Toy Adaptation Library</h1>
      <div className="flex gap-3 items-center flex-wrap mb-6">
        <input
          type="text"
          placeholder="Search by toy name…"
          className="flex-1 min-w-48 border rounded-lg px-3 py-2 text-sm bg-white"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-2">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors ${
                difficulty === d
                  ? 'bg-[#1e3a5f] text-white'
                  : 'bg-white border text-gray-600 hover:bg-gray-50'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400">
          {filtered.length} tutorial{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>
      {filtered.length === 0 ? (
        <p className="text-center text-gray-400 py-16">No tutorials found.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((t) => (
            <TutorialCard key={t.id} tutorial={t} />
          ))}
        </div>
      )}
    </div>
  )
}
