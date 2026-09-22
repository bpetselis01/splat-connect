'use client'
/**
 * The host's side of 069: what a family is asked to cover, set on the manage
 * screen after publishing without resending the whole event.
 *
 * Dollars are typed and cents are sent — cost-panel.tsx's dollarsToCents does
 * the conversion for the same reason it exists there. Blank or $0 clears both
 * columns and the public page goes back to "Free to attend".
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { HandCoins } from '@phosphor-icons/react/dist/ssr'
import { formatCents } from '@splat-connect/types'
import { browserApiClient } from '@/lib/browser-api-client'
import { dollarsToCents } from '@/components/cost-panel'

export function EventCostEditor({
  orgId,
  eventId,
  costCents,
  costNote,
}: {
  orgId: string
  eventId: string
  costCents: number | null
  costNote: string | null
}) {
  const router = useRouter()
  const [dollars, setDollars] = useState(costCents ? (costCents / 100).toFixed(2) : '')
  const [note, setNote] = useState(costNote ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [, startTransition] = useTransition()

  const cents = dollars.trim() === '' ? 0 : dollarsToCents(dollars)
  const dirty = (cents ?? 0) !== (costCents ?? 0) || note.trim() !== (costNote ?? '')

  async function save() {
    if (cents === null) return setError('Write the amount as dollars, like 12 or 12.50.')
    setError(null)
    setBusy(true)
    try {
      await browserApiClient.patch(`/api/organizations/${orgId}/events/${eventId}`, {
        cost_cents: cents,
        cost_note: note.trim(),
      })
      startTransition(() => router.refresh())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not save. Try once more.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card-flat mt-6 px-5 py-[18px]">
      <div className="flex flex-wrap items-start justify-between gap-3.5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.1em] text-muted">
            <HandCoins weight="bold" aria-hidden="true" />
            What it costs a family to come
          </h2>
          <p className="mt-[5px] max-w-[56ch] text-[13.5px] leading-[1.5] text-muted">
            Itemise anything a family is asked to pay for. Leave it empty and the event shows as
            free to attend. SPLAT never takes the payment — families settle it with you directly.
          </p>
        </div>
        <span className="shrink-0 rounded-[14px] bg-honey-soft px-3.5 py-2 text-right text-ink">
          <span className="block text-[10.5px] font-extrabold uppercase tracking-[.08em]">They pay back</span>
          <span className="block font-display text-[22px] font-extrabold leading-[1.1] tabular-nums">
            {formatCents(cents ?? 0)}
          </span>
        </span>
      </div>

      <div className="mt-3.5 grid gap-3 sm:grid-cols-[minmax(0,160px)_minmax(0,1fr)]">
        <label className="block">
          <span className="form-label mb-1.5 text-[13px] text-muted">Amount, in dollars</span>
          <input
            inputMode="decimal"
            value={dollars}
            onChange={(e) => setDollars(e.target.value)}
            placeholder="0.00"
            className="field"
          />
        </label>
        <label className="block">
          <span className="form-label mb-1.5 text-[13px] text-muted">Breakdown, in your words</span>
          <textarea
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. kits are bought in bulk and passed on at cost — $12 is what one bench uses."
            className="field"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy || !dirty}
          className="btn btn-quiet min-h-11 px-3.5 text-sm"
        >
          {busy ? 'Saving…' : 'Save cost'}
        </button>
        <span className="text-[13px] text-muted">
          {cents ? `Shown on the public page as ${formatCents(cents)} towards materials.` : 'Nothing listed — this event shows as free to attend.'}
        </span>
      </div>
      {error && (
        <p role="alert" className="alert alert-danger mt-2">
          {error}
        </p>
      )}
    </section>
  )
}
