'use client'
import { useState } from 'react'
import { ToyLibraryCard } from '@/components/toy-library-card'
import type { ToyWithOwner } from '@splat-connect/types'

type ConditionBucket = 'all' | 'good' | 'fair' | 'well-loved'

const CONDITION_LABELS: Record<ConditionBucket, string> = {
  all: 'Any',
  good: 'Good (7–10)',
  fair: 'Fair (4–6)',
  'well-loved': 'Well-loved (1–3)',
}
const CONDITIONS: ConditionBucket[] = ['all', 'good', 'fair', 'well-loved']

function matchesCondition(condition: number, bucket: ConditionBucket): boolean {
  if (bucket === 'all') return true
  if (bucket === 'good') return condition >= 7
  if (bucket === 'fair') return condition >= 4 && condition <= 6
  return condition <= 3
}

export function ToyLibraryClient({
  toys,
  savedIds,
  signedIn,
}: {
  toys: ToyWithOwner[]
  savedIds: string[]
  signedIn: boolean
}) {
  // A Set rather than repeated .includes: the lookup runs once per card.
  const saved = new Set(savedIds)
  const [search, setSearch] = useState('')
  const [condition, setCondition] = useState<ConditionBucket>('all')
  const [switchAdaptedOnly, setSwitchAdaptedOnly] = useState(false)

  const filtered = toys.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase())
    const matchesSwitch = !switchAdaptedOnly || t.switch_adapted
    return matchesSearch && matchesCondition(t.condition, condition) && matchesSwitch
  })

  return (
    <div>
      <h1 className="mb-6 title-hub">Toy Library</h1>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label htmlFor="toy-library-search" className="sr-only">
          Search by toy name
        </label>
        <input
          id="toy-library-search"
          type="search"
          placeholder="Search by toy name…"
          className="field field-sm min-w-48 max-w-sm flex-1"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {CONDITIONS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={condition === c}
              onClick={() => setCondition(c)}
              className="chip"
            >
              {CONDITION_LABELS[c]}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={switchAdaptedOnly}
            onClick={() => setSwitchAdaptedOnly((v) => !v)}
            className="chip"
          >
            Switch-adapted
          </button>
        </div>
        <span aria-live="polite" className="text-xs font-semibold text-muted">
          {filtered.length} toy{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <span aria-hidden="true" className="empty-badge">
            🔍
          </span>
          <p className="mt-4 font-bold text-ink">No toys found.</p>
          <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
            Try a shorter search, or set the filters back to Any.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((t) => (
            <ToyLibraryCard
              key={t.id}
              toy={t}
              save={{ slug: 'toys', id: t.id, saved: saved.has(t.id), signedIn }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
