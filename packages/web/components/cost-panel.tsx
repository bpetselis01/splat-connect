'use client'

/**
 * What a handover costs, on the exchange that incurred it.
 *
 * The brief's Disclosure rule decides the shape: keep the *decision* visible and
 * hide the *evidence*. The decision is the figure at the top and whether it is
 * settled; the evidence is which satchel cost what, and that goes behind the
 * caret.
 *
 * A covered line still appears, at $0.00, and that is the whole point of 056's
 * `claiming` flag — it says somebody absorbed a cost, which is different from
 * no cost existing. Hiding those lines would turn a generous act into a blank.
 *
 * Settling is a real write, not a checkbox that forgets. It is also the one
 * control here, because SPLAT never handles the money: everything else on this
 * panel is a record of something that happened elsewhere.
 */
import { useState, useTransition } from 'react'
import { Bank, Quotes, Receipt } from '@phosphor-icons/react/dist/ssr'
import { formatCents } from '@splat-connect/types'
import { Disclosure } from '@/components/disclosure'
import { browserApiClient } from '@/lib/browser-api-client'

export interface CostLine {
  id: string
  description: string
  amount_cents: number
  claiming: boolean
  settled_at: string | null
}

export interface Settlement {
  note: string | null
  method: string | null
  receipt_path: string | null
}

export function CostPanel({
  lines,
  settlement,
  noteByName,
  /** Who is reading. The heading is about them, so it has to know. */
  viewerOwes,
}: {
  lines: CostLine[]
  settlement: Settlement | null
  noteByName?: string | null
  viewerOwes: boolean
}) {
  const [rows, setRows] = useState(lines)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // No lines is not an empty state to decorate — it means nobody has said this
  // costs anything, and the honest render of that is nothing at all.
  if (rows.length === 0) return null

  // Recomputed from the rows this component holds rather than taken as a prop,
  // so settling a line moves the headline figure without a round trip.
  const outstanding = rows
    .filter((r) => r.claiming && !r.settled_at)
    .reduce((sum, r) => sum + r.amount_cents, 0)
  const allSettled = rows.filter((r) => r.claiming).every((r) => r.settled_at)

  function toggle(line: CostLine) {
    setError(null)
    startTransition(async () => {
      try {
        const next = !line.settled_at
        await browserApiClient.patch(`/api/exchange-costs/${line.id}/settle`, { settled: next })
        setRows((prev) =>
          prev.map((r) =>
            r.id === line.id ? { ...r, settled_at: next ? new Date().toISOString() : null } : r
          )
        )
      } catch {
        // Says what failed rather than silently reverting — somebody who just
        // pressed "settled" needs to know it did not take.
        setError('That did not save. Check your connection and try again.')
      }
    })
  }

  return (
    <section
      aria-labelledby="cost-heading"
      className="rounded-[var(--radius-card)] border border-line bg-surface shadow-e2"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 p-6 pb-4">
        <div className="min-w-0">
          <h2 id="cost-heading" className="text-xs font-extrabold uppercase tracking-widest text-muted">
            {viewerOwes ? 'What the handover costs you' : 'What you asked back'}
          </h2>
          <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted">
            SPLAT never handles the money — you settle it directly, and either of you can mark it
            done.
          </p>
        </div>
        <p
          className={`shrink-0 rounded-[var(--radius-field)] px-4 py-2 text-right ${
            allSettled ? 'bg-mint-soft' : 'bg-honey-soft'
          }`}
        >
          <span className="block text-[11px] font-extrabold uppercase tracking-widest text-muted">
            {allSettled ? 'Settled' : viewerOwes ? 'You pay back' : 'Owed to you'}
          </span>
          <span
            data-testid="cost-total"
            className="font-mono text-2xl font-bold tabular-nums text-ink"
          >
            {formatCents(outstanding)}
          </span>
        </p>
      </div>

      <Disclosure summary="Breakdown">
        <ul className="flex list-none flex-col gap-2">
          {rows.map((line) => (
            <li
              key={line.id}
              className="flex flex-wrap items-center gap-3 rounded-[var(--radius-panel)] bg-canvas px-4 py-3"
            >
              <span className="min-w-0 flex-1 truncate text-ink">{line.description}</span>
              <span className="badge bg-sunken text-brand-deep">
                {line.claiming ? 'Claiming back' : 'Covering it'}
              </span>
              <span className="font-mono font-bold tabular-nums text-ink">
                {/* A covered line reads as nothing owed, because it is. Its own
                    cost still sits in the row above as the description. */}
                {formatCents(line.claiming ? line.amount_cents : 0)}
              </span>
              {line.claiming && (
                <button
                  type="button"
                  onClick={() => toggle(line)}
                  disabled={pending}
                  className="btn btn-sm btn-quiet"
                >
                  {line.settled_at ? 'Settled' : 'Mark settled'}
                </button>
              )}
            </li>
          ))}
        </ul>

        {settlement?.note && (
          <figure className="mt-3 flex gap-3 rounded-[var(--radius-panel)] bg-canvas p-4">
            <Quotes size={20} weight="fill" aria-hidden="true" className="shrink-0 text-muted" />
            <div className="min-w-0">
              <p className="text-sm leading-relaxed text-ink">{settlement.note}</p>
              {noteByName && (
                // A quote glyph and a byline, never a left-border accent bar.
                <figcaption className="mt-1 text-[13px] text-muted">
                  {noteByName}’s note
                </figcaption>
              )}
            </div>
          </figure>
        )}
      </Disclosure>

      {error && (
        <p role="alert" className="px-6 pb-2 text-sm text-danger">
          {error}
        </p>
      )}

      {(settlement?.method || settlement?.receipt_path) && (
        <p className="flex flex-wrap items-center gap-4 border-t border-line px-6 py-3 text-sm text-muted">
          {settlement.method && (
            <span className="inline-flex items-center gap-2">
              <Bank size={18} weight="duotone" aria-hidden="true" />
              {settlement.method}
            </span>
          )}
          {settlement.receipt_path && (
            <span className="inline-flex items-center gap-2">
              <Receipt size={18} weight="duotone" aria-hidden="true" />
              Receipt attached
            </span>
          )}
        </p>
      )}
    </section>
  )
}
