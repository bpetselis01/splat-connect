'use client'
/**
 * Ask for a toy.
 *
 * Two ways to ask, and the difference is worth stating plainly because it
 * changes who has to agree: a swap needs both families to say yes, and a
 * straight ask needs only the holder. The radio says exactly that rather than
 * naming the two "exchange" and "donation", which are words for the database.
 *
 * Every one of your own toys is listed, including the ones you cannot offer,
 * with the reason. A picker that silently omitted a draft would leave somebody
 * hunting for a toy they can see on their own shelf.
 *
 * The note is what gets a yes, and it goes to the thread as your first message
 * rather than into a column — it is prose addressed to one person, and it means
 * the owner's list row previews it without anything extra.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Gift, ArrowsLeftRight, Plus } from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'
import { Badge } from '@/components/badge'
import type { Toy, ToyTransaction } from '@splat-connect/types'

const COLLECTION = [
  'I can collect',
  'Could you drop it off?',
  'Happy to cover postage',
] as const

/** Why one of your own toys cannot be offered, or null when it can. */
function blockedReason(toy: Toy, offeredElsewhere: Set<string>): string | null {
  if (toy.status !== 'published') return 'Draft — list it and it can be offered.'
  if (offeredElsewhere.has(toy.id)) return 'Already offered in another open exchange.'
  return null
}

export function RequestToyForm({
  toyId,
  holderName,
  offerType,
  myToys,
  offeredElsewhere,
  suburb,
}: {
  toyId: string
  holderName: string
  offerType: 'donation' | 'exchange' | 'both' | null
  myToys: Toy[]
  /** Ids of your toys already promised to another open exchange. */
  offeredElsewhere: string[]
  suburb: string | null
}) {
  const router = useRouter()
  const blocked = new Set(offeredElsewhere)
  const offerable = myToys.filter((t) => blockedReason(t, blocked) === null)

  // A holder who only accepts one kind decides for you, and the radio is not
  // shown at all — offering a choice that will be refused is worse than not
  // offering one.
  const canSwap = offerType === 'exchange' || offerType === 'both'
  const canAsk = offerType === 'donation' || offerType === 'both'

  const [mode, setMode] = useState<'exchange' | 'donation'>(canSwap && offerable.length > 0 ? 'exchange' : 'donation')
  const [offeredToyId, setOfferedToyId] = useState(offerable[0]?.id ?? '')
  const [note, setNote] = useState('')
  const [collection, setCollection] = useState<string>(COLLECTION[0])
  const [when, setWhen] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const valid = note.trim() && (mode === 'donation' || offeredToyId)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    setError(null)
    setSaving(true)
    try {
      // One message, the way a person would write it: what it is for, then how
      // and when. Splitting it into three columns would make the owner read a
      // form where they expected a note.
      const collectionLine = suburb ? `${collection} from ${suburb}.` : `${collection}.`
      const body = [note.trim(), [collectionLine, when.trim()].filter(Boolean).join(' ')]
        .filter(Boolean)
        .join('\n\n')

      const tx = await browserApiClient.post<ToyTransaction>('/api/toy-transactions', {
        toy_id: toyId,
        type: mode,
        offered_toy_id: mode === 'exchange' ? offeredToyId : undefined,
        note: body,
      })
      router.push(`/dashboard/exchanges/${tx.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not send. Try once more.')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-5">
      {canSwap && canAsk && (
        <fieldset>
          <legend className="mb-1.5 text-sm font-bold text-ink">How do you want to ask?</legend>
          <div role="radiogroup" aria-label="How to ask" className="grid gap-2 sm:grid-cols-2">
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-card border p-3 ${
                mode === 'exchange' ? 'border-brand bg-brand-tint' : 'border-line bg-surface'
              } ${offerable.length === 0 ? 'opacity-60' : ''}`}
            >
              <input
                type="radio"
                name="mode"
                checked={mode === 'exchange'}
                disabled={offerable.length === 0}
                onChange={() => setMode('exchange')}
                className="mt-1"
              />
              <span>
                <span className="flex items-center gap-1.5 font-bold text-ink">
                  <ArrowsLeftRight className="h-4 w-4" aria-hidden="true" />
                  Offer a toy back
                </span>
                <span className="block text-xs leading-relaxed text-muted">
                  {offerable.length === 0
                    ? 'You have no listed toys to offer yet.'
                    : 'A swap. You pick one of yours, they see it, and you both confirm the handover.'}
                </span>
              </span>
            </label>

            <label
              className={`flex cursor-pointer items-start gap-3 rounded-card border p-3 ${
                mode === 'donation' ? 'border-brand bg-brand-tint' : 'border-line bg-surface'
              }`}
            >
              <input
                type="radio"
                name="mode"
                checked={mode === 'donation'}
                onChange={() => setMode('donation')}
                className="mt-1"
              />
              <span>
                <span className="flex items-center gap-1.5 font-bold text-ink">
                  <Gift className="h-4 w-4" aria-hidden="true" />
                  Just ask
                </span>
                <span className="block text-xs leading-relaxed text-muted">
                  A one-way request. {holderName} confirms it alone.
                </span>
              </span>
            </label>
          </div>
        </fieldset>
      )}

      {mode === 'exchange' && (
        <fieldset className="card p-5">
          <legend className="px-1 font-bold text-ink">Pick a toy to offer</legend>
          <p className="mb-3 text-sm leading-relaxed text-muted">
            From your library. Only the one you pick is shown to {holderName} — the rest of your
            listings stay where they are. A swap needs both families to say yes.
          </p>

          {myToys.length === 0 ? (
            <p className="text-sm text-muted">
              Nothing listed yet.{' '}
              <Link href="/dashboard/toys/new" className="font-semibold text-brand-dark hover:underline">
                Add a toy
              </Link>{' '}
              and it can be offered.
            </p>
          ) : (
            <ul className="flex list-none flex-col gap-2">
              {myToys.map((t) => {
                const reason = blockedReason(t, blocked)
                return (
                  <li key={t.id}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-card border p-3 ${
                        offeredToyId === t.id ? 'border-brand bg-brand-tint' : 'border-line bg-surface'
                      } ${reason ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      <input
                        type="radio"
                        name="offered"
                        checked={offeredToyId === t.id}
                        disabled={!!reason}
                        onChange={() => setOfferedToyId(t.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold text-ink">{t.name}</span>
                        <span className="block text-xs text-muted">
                          {reason ?? t.description ?? 'Listed and available.'}
                        </span>
                      </span>
                      <Badge status={t.status === 'published' ? 'published' : 'draft'} />
                    </label>
                  </li>
                )
              })}
            </ul>
          )}

          {offeredToyId && (
            <p className="mt-3 text-sm text-muted">
              {/* The thing somebody worries about before pressing send. */}
              Offering {myToys.find((t) => t.id === offeredToyId)?.name}. It stays listed until{' '}
              {holderName} accepts, so you are not holding it back from anyone else.
            </p>
          )}

          <p className="mt-3">
            <Link href="/dashboard/toys/new" className="btn btn-quiet btn-sm">
              <Plus className="h-4 w-4" aria-hidden="true" />
              List another toy first
            </Link>
          </p>
        </fieldset>
      )}

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-ink">Say who it is for</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          maxLength={1800}
          placeholder="My son is four and presses with a flat palm. He has the same dog unadapted and loves it — a wired one would let him set it off himself."
          className="field"
        />
        <span className="mt-1.5 block text-xs text-muted">
          A line or two about the child is what gets a yes. You do not have to explain a
          diagnosis.
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink">How you would collect</span>
          <select
            value={collection}
            onChange={(e) => setCollection(e.target.value)}
            className="field"
          >
            {COLLECTION.map((c) => (
              <option key={c} value={c}>
                {suburb && c === COLLECTION[0] ? `${c} from ${suburb}` : c}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink">
            When suits you <span className="font-semibold text-muted">(optional)</span>
          </span>
          <input
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            maxLength={120}
            placeholder="e.g. Weekends"
            className="field"
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}

      <div>
        <button type="submit" disabled={!valid || saving} className="btn btn-primary">
          {mode === 'exchange' ? (
            <ArrowsLeftRight className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Gift className="h-4 w-4" aria-hidden="true" />
          )}
          {saving ? 'Sending…' : `Ask ${holderName}`}
        </button>
        {!note.trim() && (
          <p className="mt-2 text-sm text-muted">
            The note is the part that gets a yes — it is the only thing required here.
          </p>
        )}
      </div>
    </form>
  )
}
