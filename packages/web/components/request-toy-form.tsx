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
import { Gift, ArrowsLeftRight, Plus, HandHeart, Check } from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'
import { CardPhoto, tintFor } from '@/components/card-photo'
import { gradeOf } from '@/lib/toy-grade'
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
  initialMode,
}: {
  toyId: string
  holderName: string
  offerType: 'donation' | 'exchange' | 'both' | null
  myToys: Toy[]
  /** Ids of your toys already promised to another open exchange. */
  offeredElsewhere: string[]
  suburb: string | null
  /** Which of the detail rail's two buttons brought you here (?mode=). */
  initialMode?: 'exchange' | 'donation'
}) {
  const router = useRouter()
  const blocked = new Set(offeredElsewhere)
  const offerable = myToys.filter((t) => blockedReason(t, blocked) === null)

  // A holder who only accepts one kind decides for you, and the radio is not
  // shown at all — offering a choice that will be refused is worse than not
  // offering one.
  const canSwap = offerType === 'exchange' || offerType === 'both'
  const canAsk = offerType === 'donation' || offerType === 'both'

  const [mode, setMode] = useState<'exchange' | 'donation'>(
    initialMode === 'donation' && canAsk
      ? 'donation'
      : canSwap && offerable.length > 0
        ? 'exchange'
        : 'donation'
  )
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

  const offered = myToys.find((t) => t.id === offeredToyId)

  return (
    <form onSubmit={submit} className="mt-[26px] flex flex-col gap-5">
      {canSwap && canAsk ? (
        <fieldset>
          <legend className="mb-2 text-sm font-extrabold text-ink">How do you want to ask?</legend>
          <div role="radiogroup" aria-label="How to ask" className="grid gap-3 sm:grid-cols-2">
            <ModeCard
              on={mode === 'exchange'}
              disabled={offerable.length === 0}
              onPick={() => setMode('exchange')}
              tint="var(--tviolet)"
              icon={<ArrowsLeftRight size={25} weight="duotone" />}
              label="Offer a toy back"
              sub={
                offerable.length === 0
                  ? 'You have no listed toys to offer yet.'
                  : 'A swap. You pick one of yours, they see it, and you both confirm the handover.'
              }
            />
            <ModeCard
              on={mode === 'donation'}
              onPick={() => setMode('donation')}
              tint="var(--tmint)"
              icon={<HandHeart size={25} weight="duotone" />}
              label="Just ask"
              sub={`A one-way request. ${holderName} confirms it alone.`}
            />
          </div>
        </fieldset>
      ) : (
        /* A holder who only accepts one kind: the board states the rule in a
           tinted card instead of a radio with one live option. */
        <div
          className="flex items-start gap-3.5 rounded-[18px] border border-line p-[18px]"
          style={{ background: canSwap ? 'var(--tviolet)' : 'var(--tmint)', color: 'var(--tink)' }}
        >
          <span
            aria-hidden="true"
            className="grid h-[46px] w-[46px] flex-none place-items-center rounded-[14px] bg-surface"
          >
            {canSwap ? <ArrowsLeftRight size={25} weight="duotone" /> : <Gift size={25} weight="duotone" />}
          </span>
          <div className="min-w-0">
            <p className="m-0 font-display text-[17px] font-extrabold">
              {canSwap ? 'A swap for a swap' : 'A one-way ask'}
            </p>
            <p className="m-0 mt-1 max-w-[62ch] text-sm leading-[1.55]">
              {canSwap
                ? 'This listing is swap-only. Pick one of your listed toys below — a plain ask is not an option here.'
                : `This listing is a gift, so there is nothing to offer back. ${holderName} accepts or declines.`}
            </p>
          </div>
        </div>
      )}

      {mode === 'exchange' && (
        <div
          role="radiogroup"
          aria-labelledby="offer-pick-h"
          className="flex flex-col gap-4 rounded-card border border-line bg-surface p-[22px] shadow-[var(--shadow-e2)]"
        >
          <div>
            <h2 id="offer-pick-h" className="m-0 mb-1 font-display text-xl font-extrabold text-ink">
              Pick a toy to offer
            </h2>
            <p className="m-0 max-w-[62ch] text-sm leading-[1.5] text-muted">
              From your library. Only the one you pick is shown to {holderName} — the rest of your
              listings stay where they are. A swap needs both families to say yes.
            </p>
          </div>

          {myToys.length === 0 ? (
            <p className="m-0 text-sm text-muted">
              Nothing listed yet.{' '}
              <Link href="/dashboard/toys/new" className="font-semibold text-brand-dark hover:underline">
                Add a toy
              </Link>{' '}
              and it can be offered.
            </p>
          ) : (
            <ul className="m-0 grid list-none grid-cols-1 gap-3.5 p-0 sm:grid-cols-3">
              {myToys.map((t) => {
                const reason = blockedReason(t, blocked)
                const on = offeredToyId === t.id
                const grade = gradeOf(t.condition)
                return (
                  <li key={t.id}>
                    <label
                      className={`flex h-full flex-col overflow-hidden rounded-[18px] border-[3px] bg-surface text-ink shadow-[var(--shadow-e1)] transition-transform focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-[var(--focus)] ${
                        on ? 'border-[var(--b600)]' : 'border-line'
                      } ${reason ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:-translate-y-[3px] hover:shadow-[var(--shadow-e2)]'}`}
                    >
                      <input
                        type="radio"
                        name="offered"
                        checked={on}
                        disabled={!!reason}
                        onChange={() => setOfferedToyId(t.id)}
                        className="sr-only"
                      />
                      <CardPhoto src={t.photo_urls[0] ?? null} tint={tintFor(t.id)} iconSize={54}>
                        {on && (
                          <span
                            aria-hidden="true"
                            className="absolute right-2 top-2 grid h-[30px] w-[30px] place-items-center rounded-full shadow-[var(--shadow-e2)]"
                            style={{ background: 'var(--b600)', color: 'var(--onbrand)' }}
                          >
                            <Check size={15} weight="bold" />
                          </span>
                        )}
                      </CardPhoto>
                      <span className="flex flex-1 flex-col gap-1.5 px-[15px] pb-[15px] pt-[13px]">
                        <span className="font-display text-[15px] font-extrabold leading-[1.2]">{t.name}</span>
                        <span className="flex flex-wrap gap-1.5">
                          <span className="rounded-pill bg-sunken px-2.5 py-[3px] text-[11px] font-extrabold text-muted">
                            {grade.label}
                          </span>
                          <span
                            className="rounded-pill px-2.5 py-[3px] text-[11px] font-extrabold"
                            style={{
                              background: t.status !== 'published' ? 'var(--surface2)' : reason ? 'var(--tcoral)' : 'var(--tok)',
                              color: 'var(--tink)',
                            }}
                          >
                            {t.status !== 'published' ? 'Hidden' : reason ? 'Promised' : 'Live'}
                          </span>
                        </span>
                        <span className="text-[13px] leading-[1.45] text-muted">
                          {reason ?? t.description ?? 'Listed and available.'}
                        </span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}

          <p className="m-0 text-[13px] leading-[1.5] text-muted">
            {/* The thing somebody worries about before pressing send. */}
            {offered
              ? `Offering ${offered.name}. It stays listed until ${holderName} accepts, so you are not holding it back from anyone else.`
              : 'Pick one of your listed toys. Drafts and toys already promised to someone cannot be offered.'}
          </p>

          <Link
            href="/dashboard/toys/new"
            className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-pill border border-dashed border-line px-[18px] text-sm font-extrabold text-ink no-underline hover:border-brand"
          >
            <Plus size={14} weight="bold" aria-hidden="true" />
            List another toy first
          </Link>
        </div>
      )}

      {mode === 'donation' && canSwap && canAsk && (
        <div className="flex items-start gap-3.5 rounded-card border border-line bg-surface p-[22px] shadow-[var(--shadow-e2)]">
          <Gift size={28} weight="duotone" className="flex-none text-brand-dark" aria-hidden="true" />
          <div>
            <p className="m-0 font-display text-[17px] font-extrabold text-ink">A one-way ask</p>
            <p className="m-0 mt-1 max-w-[62ch] text-sm leading-[1.55] text-muted">
              Nothing is offered in return. {holderName} accepts or declines. Most families here
              give without wanting anything back.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-[22px] shadow-[var(--shadow-e2)]">
        <label className="block">
          <span className="mb-[7px] block text-sm font-extrabold text-ink">Say who it is for</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            maxLength={1800}
            placeholder="My son is four and presses with a flat palm. He has the same dog unadapted and loves it — a wired one would let him set it off himself."
            className="field"
          />
          <span className="mt-2 block text-[13px] leading-[1.5] text-muted">
            A line or two about the child is what gets a yes. You do not have to explain a
            diagnosis.
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-[7px] block text-sm font-extrabold text-ink">How you would collect</span>
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
            <span className="mb-[7px] block text-sm font-extrabold text-ink">
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

        {/* Only what actually reaches the holder: the request carries your name
            and this note (with the collect line folded in), plus the toy you
            offer. No distance is computed, so none is promised. */}
        <div className="rounded-[18px] border border-line px-[18px] py-4" style={{ background: 'var(--b50)' }}>
          <p className="m-0 text-sm leading-[1.55] text-muted">
            <strong className="text-ink">What {holderName} sees:</strong> your name and your note
            {mode === 'exchange' && offered ? `, and the listing for ${offered.name}` : ''}. Never
            your address or your number.
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={!valid || saving} className="btn btn-primary">
          {mode === 'exchange' ? (
            <ArrowsLeftRight size={18} weight="bold" aria-hidden="true" />
          ) : (
            <HandHeart size={18} weight="bold" aria-hidden="true" />
          )}
          {saving
            ? 'Sending…'
            : mode === 'exchange'
              ? offered
                ? `Offer ${offered.name}`
                : 'Send the swap offer'
              : 'Send the request'}
        </button>
        <Link href={`/toy-library/${toyId}`} className="btn btn-quiet btn-lg no-underline">
          Back to the toy
        </Link>
      </div>
      {!note.trim() && (
        <p className="m-0 mb-2 text-[13px] leading-[1.5] text-muted">
          The note is the part that gets a yes — it is the only thing required here.
        </p>
      )}
    </form>
  )
}

/** One of the two "how to ask" options, drawn as the board's card. The native
 *  radio stays, visually hidden, so keyboard and screen-reader behaviour is the
 *  platform's. */
function ModeCard({
  on,
  disabled,
  onPick,
  tint,
  icon,
  label,
  sub,
}: {
  on: boolean
  disabled?: boolean
  onPick: () => void
  tint: string
  icon: React.ReactNode
  label: string
  sub: string
}) {
  return (
    <label
      className={`flex items-start gap-3.5 rounded-[18px] border-2 p-[18px] text-ink focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-[var(--focus)] ${
        on ? 'border-[var(--b600)]' : 'border-line'
      } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-brand'}`}
      style={{ background: on ? 'var(--b50)' : 'var(--surface)' }}
    >
      <input
        type="radio"
        name="mode"
        checked={on}
        disabled={disabled}
        onChange={onPick}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className="grid h-[46px] w-[46px] flex-none place-items-center rounded-[14px]"
        style={{ background: tint, color: 'var(--tink)' }}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-display text-[17px] font-extrabold">{label}</span>
        <span className="mt-[3px] block text-sm leading-[1.5] text-muted">{sub}</span>
      </span>
    </label>
  )
}
