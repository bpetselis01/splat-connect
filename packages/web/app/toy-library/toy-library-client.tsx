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
import Link from 'next/link'
import { Gift, HandHeart, MapPin, Smiley, Sparkle, HandTap, MagnifyingGlass, X } from '@phosphor-icons/react/dist/ssr'
import { ToyLibraryCard } from '@/components/toy-library-card'
import { BrowseHero } from '@/components/browse-hero'
import { SplatMascot } from '@/components/splat-mascot'
import type { ToyWithOwner } from '@splat-connect/types'

type ConditionBucket = 'good' | 'fair' | 'well-loved'

const CONDITION_LABELS: Record<ConditionBucket, string> = {
  good: 'Good',
  fair: 'Fair',
  'well-loved': 'Well-loved',
}
const CONDITIONS: ConditionBucket[] = ['good', 'fair', 'well-loved']

function matchesCondition(condition: number, bucket: ConditionBucket): boolean {
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
  const [conditions, setConditions] = useState<ConditionBucket[]>([])
  const [switchAdaptedOnly, setSwitchAdaptedOnly] = useState(false)

  function toggleCondition(c: ConditionBucket) {
    setConditions(conditions.includes(c) ? conditions.filter((v) => v !== c) : [...conditions, c])
  }

  const filtered = toys.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase())
    const matchesSwitch = !switchAdaptedOnly || t.switch_adapted
    // Empty means "any", so Clear and "no filters" agree.
    const matchesGrade =
      conditions.length === 0 || conditions.some((c) => matchesCondition(t.condition, c))
    return matchesSearch && matchesGrade && matchesSwitch
  })

  const adapted = toys.filter((t) => t.switch_adapted).length
  const fromOrgs = toys.filter((t) => t.owner_org_id).length

  const active = [
    ...conditions.map((c) => ({ label: CONDITION_LABELS[c], clear: () => toggleCondition(c) })),
    ...(switchAdaptedOnly
      ? [{ label: 'Switch-adapted', clear: () => setSwitchAdaptedOnly(false) }]
      : []),
    ...(search ? [{ label: `“${search}”`, clear: () => setSearch('') }] : []),
  ]

  function clearAll() {
    setConditions([])
    setSwitchAdaptedOnly(false)
    setSearch('')
  }

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
          { n: toys.length, label: 'toys listed' },
          { n: adapted, label: 'already switch-adapted' },
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
          art: <SplatMascot width={84} />,
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

          <div>
            <label
              htmlFor="toy-library-search"
              className="mb-2.5 block text-sm font-extrabold text-ink"
            >
              Search
            </label>
            <input
              id="toy-library-search"
              type="search"
              placeholder="Toy name…"
              className="field w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <fieldset>
            <legend>
              <Sparkle size={18} weight="duotone" className="text-brand-dark" aria-hidden="true" />
              Condition
            </legend>
            <div className="flex flex-wrap gap-2">
              {CONDITIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={conditions.includes(c)}
                  onClick={() => toggleCondition(c)}
                  className="chip"
                >
                  {CONDITION_LABELS[c]}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>
              <HandTap size={18} weight="duotone" className="text-brand-dark" aria-hidden="true" />
              Already adapted
            </legend>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={switchAdaptedOnly}
                onClick={() => setSwitchAdaptedOnly((v) => !v)}
                className="chip"
              >
                Switch-adapted only
              </button>
            </div>
          </fieldset>

          <p className="browse-note bg-apricot-soft">
            <MapPin size={26} weight="duotone" className="flex-none" aria-hidden="true" />
            <span>
              <strong className="font-extrabold">Nothing near you?</strong> A guide and about $30 of
              parts turns a toy you already own into this one.{' '}
              <Link href="/library" className="font-extrabold underline">
                Find a guide →
              </Link>
            </span>
          </p>
          <p className="browse-note bg-mint-soft">
            <HandHeart size={26} weight="duotone" className="flex-none" aria-hidden="true" />
            <span>
              <strong className="font-extrabold">Outgrown a toy?</strong> Somebody else&apos;s child
              is waiting for exactly it.{' '}
              <Link href="/dashboard/toys/new" className="font-extrabold underline">
                Give a toy →
              </Link>
            </span>
          </p>
        </aside>

        <div>
          <div className="browse-head">
            <h2>All toys</h2>
            <span aria-live="polite" className="text-sm font-bold text-muted">
              {filtered.length} toy{filtered.length === 1 ? '' : 's'}
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
                Try removing a filter — or follow a guide and build the one you are after.
              </p>
              <div className="flex flex-wrap justify-center gap-2.5">
                <button type="button" onClick={clearAll} className="btn btn-primary">
                  Clear filters
                </button>
                <Link href="/library" className="btn btn-quiet no-underline">
                  Browse guides instead
                </Link>
              </div>
            </div>
          ) : (
            <div className="browse-grid">
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
      </div>
    </div>
  )
}
