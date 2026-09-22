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
 * View and edit share this one shell, per the brief's feature 8. Edit is not a
 * second component and not a second screen: the same header, the same total and
 * the same disclosure, with inputs where the read-only rows were. A panel that
 * jumped to a different layout to be edited would make the figure people are
 * about to change move under them.
 *
 * Settling is a real write, not a checkbox that forgets. SPLAT never handles
 * the money: everything on this panel is a record of something that happened
 * elsewhere, which is why there is no payment state anywhere in it.
 */
import { useState, useTransition } from 'react'
import { Bank, Pencil, Quotes, Receipt, Trash } from '@phosphor-icons/react/dist/ssr'
import { formatCents } from '@splat-connect/types'
import { Disclosure } from '@/components/disclosure'
import { browserApiClient } from '@/lib/browser-api-client'

export interface CostLine {
  id: string
  description: string
  amount_cents: number
  claiming: boolean
  settled_at: string | null
  created_by?: string
}

export interface Settlement {
  note: string | null
  /** Which of the two wrote it. The byline is the point of storing a note. */
  note_by?: string | null
  method: string | null
  receipt_path: string | null
}

/**
 * Dollars as typed into a text field, as integer cents.
 *
 * Returns null for anything that is not a plain amount. Never parseFloat into
 * cents by multiplying — `12.10 * 100` is 1209.9999999999998, and a cent lost
 * to binary floating point in a number two families agreed between them is an
 * argument rather than a display bug.
 */
export function dollarsToCents(input: string): number | null {
  const match = /^\s*\$?\s*(\d{1,9})(?:\.(\d{1,2}))?\s*$/.exec(input)
  if (!match) return null
  const cents = (match[2] ?? '').padEnd(2, '0')
  return Number(match[1]) * 100 + Number(cents)
}

function AddCostForm({
  onAdd,
  busy,
}: {
  onAdd: (line: { description: string; amount_cents: number; claiming: boolean }) => void
  busy: boolean
}) {
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [claiming, setClaiming] = useState(true)
  const cents = dollarsToCents(amount)
  // A claimed line has to be worth something; a covered one need not be priced.
  // Both rules are 056's, restated here so the button is honest before the
  // request rather than after it.
  const valid = description.trim().length > 0 && cents !== null && (!claiming || cents > 0)

  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-2 rounded-[var(--radius-inset)] bg-canvas p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid || cents === null) return
        onAdd({ description: description.trim(), amount_cents: cents, claiming })
        setDescription('')
        setAmount('')
      }}
    >
      <label className="min-w-[10rem] flex-1">
        <span className="block text-[13px] font-bold text-muted">What it was for</span>
        <input
          className="field mt-1 w-full"
          value={description}
          maxLength={200}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Postage satchel"
        />
      </label>
      <label className="w-28">
        <span className="block text-[13px] font-bold text-muted">Amount</span>
        <input
          className="field mt-1 w-full font-mono tabular-nums"
          value={amount}
          inputMode="decimal"
          onChange={(e) => setAmount(e.target.value)}
          placeholder="12.50"
        />
      </label>
      <label className="w-36">
        <span className="block text-[13px] font-bold text-muted">Who absorbs it</span>
        <select
          className="field mt-1 w-full"
          value={claiming ? 'claiming' : 'covering'}
          onChange={(e) => setClaiming(e.target.value === 'claiming')}
        >
          <option value="claiming">Claiming back</option>
          <option value="covering">Covering it</option>
        </select>
      </label>
      <button type="submit" className="btn btn-soft" disabled={!valid || busy}>
        Add cost
      </button>
    </form>
  )
}

export function CostPanel({
  lines,
  settlement,
  noteByName,
  viewerName,
  /** Who is reading. The heading is about them, so it has to know. */
  viewerOwes,
  transactionId,
  viewerId,
  /** A party to an exchange that can still change. Omit for a read-only view. */
  canEdit = false,
  /** The board words this kind of handover: "What this print costs you", and
   *  who gives what free. Read by the side that pays; the giver's heading
   *  stays "What you asked back". */
  heading,
  intro,
}: {
  lines: CostLine[]
  settlement: Settlement | null
  /** The other party's name, for a note they wrote. */
  noteByName?: string | null
  /** The reader's own name, for a note the reader wrote. */
  viewerName?: string | null
  viewerOwes: boolean
  transactionId: string
  viewerId?: string
  canEdit?: boolean
  heading?: string
  intro?: string
}) {
  const [rows, setRows] = useState(lines)
  const [terms, setTerms] = useState<Settlement>(
    settlement ?? { note: null, note_by: null, method: null, receipt_path: null }
  )
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // No lines and nothing to add is not an empty state to decorate — it means
  // nobody has said this costs anything, and the honest render of that is
  // nothing at all.
  if (rows.length === 0 && !canEdit) return null

  // Recomputed from the rows this component holds rather than taken as a prop,
  // so settling or adding a line moves the headline figure without a round trip.
  const outstanding = rows
    .filter((r) => r.claiming && !r.settled_at)
    .reduce((sum, r) => sum + r.amount_cents, 0)
  const claimed = rows.filter((r) => r.claiming)
  const allSettled = claimed.length > 0 && claimed.every((r) => r.settled_at)
  const byline = terms.note_by && terms.note_by === viewerId ? viewerName : noteByName

  /** Every write on this panel reports its own failure rather than reverting. */
  function write(work: () => Promise<void>, failure: string) {
    setError(null)
    startTransition(async () => {
      try {
        await work()
      } catch {
        setError(failure)
      }
    })
  }

  function toggle(line: CostLine) {
    const next = !line.settled_at
    write(async () => {
      await browserApiClient.patch(`/api/exchange-costs/${line.id}/settle`, { settled: next })
      setRows((prev) =>
        prev.map((r) =>
          r.id === line.id ? { ...r, settled_at: next ? new Date().toISOString() : null } : r
        )
      )
    }, 'That did not save. Check your connection and try again.')
  }

  function add(line: { description: string; amount_cents: number; claiming: boolean }) {
    write(async () => {
      const created = await browserApiClient.post<CostLine>(
        `/api/exchange-costs/${transactionId}`,
        line
      )
      setRows((prev) => [...prev, created])
    }, 'That cost did not save. Check your connection and try again.')
  }

  function remove(line: CostLine) {
    write(async () => {
      await browserApiClient.delete(`/api/exchange-costs/${line.id}`)
      setRows((prev) => prev.filter((r) => r.id !== line.id))
    }, 'That cost did not come off. Check your connection and try again.')
  }

  function saveTerms(next: Settlement) {
    write(async () => {
      // note_by is the API's to stamp, never the client's word for it.
      await browserApiClient.put(`/api/exchange-costs/${transactionId}/settlement`, {
        note: next.note,
        method: next.method,
        receipt_path: next.receipt_path,
      })
      // The API stamps note_by with the caller, so the byline the reader sees
      // after saving is their own name rather than the last author's.
      setTerms({ ...next, note_by: next.note ? (viewerId ?? null) : null })
      setEditing(false)
    }, 'The note did not save. Check your connection and try again.')
  }

  function uploadReceipt(file: File) {
    const form = new FormData()
    form.append('file', file)
    write(async () => {
      const { receipt_path } = await browserApiClient.postFormData<{ receipt_path: string }>(
        `/api/exchange-costs/${transactionId}/receipt`,
        form
      )
      // The upload only produces a path; the settlement row is what points at
      // it, so a failure here leaves an orphan object rather than a row naming
      // a file that is not there.
      const next: Settlement = { ...terms, receipt_path }
      await browserApiClient.put(`/api/exchange-costs/${transactionId}/settlement`, next)
      setTerms(next)
    }, 'The receipt did not upload. Check the file and try again.')
  }

  return (
    <section
      aria-labelledby="cost-heading"
      className="rounded-[var(--radius-inset)] border border-line bg-surface shadow-e1"
    >
      <div className="flex flex-wrap items-start justify-between gap-[14px] p-[18px_20px] pb-[13px]">
        <div className="min-w-0">
          <h2 id="cost-heading" className="text-xs font-extrabold uppercase tracking-widest text-muted">
            {viewerOwes ? (heading ?? 'What the handover costs you') : 'What you asked back'}
          </h2>
          <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted">
            {(viewerOwes && intro) ||
              'SPLAT never handles the money — you settle it directly, and either of you can mark it done.'}
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
            className="font-display text-[22px] font-extrabold leading-[1.1] tabular-nums text-ink"
          >
            {formatCents(outstanding)}
          </span>
        </p>
      </div>

      <Disclosure summary="Breakdown">
        {rows.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted">
            Nobody has said this costs anything yet.
          </p>
        ) : (
          <ul className="flex list-none flex-col gap-2">
            {rows.map((line) => (
              <li
                key={line.id}
                className="flex flex-wrap items-center gap-[10px] rounded-[var(--radius-field)] bg-sunken px-[13px] py-[10px]"
              >
                <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-ink">{line.description}</span>
                <span className="badge bg-sunken text-brand-deep">
                  {line.claiming ? 'Claiming back' : 'Covering it'}
                </span>
                <span className="font-mono text-[15px] font-bold tabular-nums text-ink">
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
                {/* Only whoever added the line may remove it — 055's delete
                    policy says the same thing, and a control the database will
                    refuse is a dead control. */}
                {canEdit && line.created_by === viewerId && (
                  <button
                    type="button"
                    onClick={() => remove(line)}
                    disabled={pending}
                    className="btn btn-sm btn-quiet"
                    aria-label={`Remove ${line.description}`}
                  >
                    <Trash size={16} weight="bold" aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canEdit && <AddCostForm onAdd={add} busy={pending} />}

        {editing ? (
          <form
            className="mt-3 flex flex-col gap-3 rounded-[var(--radius-inset)] bg-canvas p-4"
            onSubmit={(e) => {
              e.preventDefault()
              const form = new FormData(e.currentTarget)
              saveTerms({
                ...terms,
                note: String(form.get('note') ?? '').trim() || null,
                method: String(form.get('method') ?? '').trim() || null,
              })
            }}
          >
            <label>
              <span className="block text-[13px] font-bold text-muted">A note about the money</span>
              <textarea
                name="note"
                rows={3}
                maxLength={1000}
                defaultValue={terms.note ?? ''}
                className="field mt-1 w-full"
                placeholder="Happy to wait until after the handover."
              />
            </label>
            <label className="max-w-xs">
              <span className="block text-[13px] font-bold text-muted">How it changed hands</span>
              <input
                name="method"
                maxLength={60}
                defaultValue={terms.method ?? ''}
                className="field mt-1 w-full"
                placeholder="Bank transfer"
              />
            </label>
            <label className="max-w-xs">
              <span className="block text-[13px] font-bold text-muted">
                Receipt, if you have one
              </span>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="mt-1 w-full text-sm"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) uploadReceipt(file)
                }}
              />
            </label>
            <div className="flex gap-2">
              <button type="submit" className="btn btn-soft" disabled={pending}>
                Save
              </button>
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => setEditing(false)}
                disabled={pending}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            {terms.note && (
              <figure className="mt-3 flex gap-3 rounded-[var(--radius-inset)] bg-canvas p-4">
                <Quotes size={20} weight="fill" aria-hidden="true" className="shrink-0 text-muted" />
                <div className="min-w-0">
                  <p className="text-sm leading-relaxed text-ink">{terms.note}</p>
                  {/* Attributed to whoever wrote it. It used to name the other
                      party unconditionally, which put their name under a note
                      the reader had just written themselves. */}
                  {byline && (
                    // A quote glyph and a byline, never a left-border accent bar.
                    <figcaption className="mt-1 text-[13px] text-muted">{byline}’s note</figcaption>
                  )}
                </div>
              </figure>
            )}
            {canEdit && (
              <button
                type="button"
                className="btn btn-quiet mt-3"
                onClick={() => setEditing(true)}
                disabled={pending}
              >
                <Pencil size={16} weight="bold" aria-hidden="true" />
                {terms.note || terms.method ? 'Edit the note' : 'Add a note or receipt'}
              </button>
            )}
          </>
        )}
      </Disclosure>

      {error && (
        <p role="alert" className="px-6 pb-2 text-sm text-danger">
          {error}
        </p>
      )}

      {(terms.method || terms.receipt_path) && (
        <p className="flex flex-wrap items-center gap-4 border-t border-line px-6 py-3 text-sm text-muted">
          {terms.method && (
            <span className="inline-flex items-center gap-2">
              <Bank size={18} weight="duotone" aria-hidden="true" />
              {terms.method}
            </span>
          )}
          {terms.receipt_path && (
            <a
              className="inline-flex items-center gap-2 underline"
              href={`/files/exchange-receipts/${terms.receipt_path}`}
            >
              <Receipt size={18} weight="duotone" aria-hidden="true" />
              Receipt attached
            </a>
          )}
        </p>
      )}
    </section>
  )
}
