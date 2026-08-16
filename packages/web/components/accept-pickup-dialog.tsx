'use client'
/**
 * The pickup address an owner supplies when accepting a request.
 *
 * Split out of toy-transaction-thread.tsx rather than inlined: the thread is
 * about the conversation and its actions, and this is a self-contained form
 * with its own draft state that only matters between opening and submitting.
 *
 * Dialog mechanics are delete-entity-button.tsx's — a native <dialog> driven by
 * showModal()/close() from an effect, so the focus trap, Escape, and the inert
 * background come from the platform.
 */
import { useEffect, useRef, useState } from 'react'
import type { PickupAddress } from '@splat-connect/types'

const FIELDS: Array<{ key: keyof PickupAddress; label: string }> = [
  { key: 'pickup_line1', label: 'Street address' },
  { key: 'pickup_suburb', label: 'Suburb' },
  { key: 'pickup_state', label: 'State' },
  { key: 'pickup_postcode', label: 'Postcode' },
]

const EMPTY: PickupAddress = {
  pickup_line1: '',
  pickup_suburb: '',
  pickup_state: '',
  pickup_postcode: '',
}

export function formatAddress(address: PickupAddress): string {
  return FIELDS.map((f) => address[f.key])
    .filter(Boolean)
    .join(', ')
}

export function AcceptPickupDialog({
  open,
  defaultAddress,
  busy,
  onCancel,
  onSubmit,
}: {
  open: boolean
  /** The owner's saved profile address, or null when they have not set one. */
  defaultAddress: PickupAddress | null
  busy: boolean
  onCancel: () => void
  onSubmit: (address: PickupAddress) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [useDefault, setUseDefault] = useState(true)
  const [draft, setDraft] = useState<PickupAddress>(EMPTY)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // Reopening starts clean: a half-typed address abandoned last time is not
  // what the owner means to send now.
  useEffect(() => {
    if (open) {
      setUseDefault(defaultAddress !== null)
      setDraft(EMPTY)
    }
  }, [open, defaultAddress])

  const chosen = useDefault && defaultAddress ? defaultAddress : draft
  const complete = FIELDS.every((f) => chosen[f.key].trim())

  return (
    <dialog
      ref={ref}
      className="dialog-panel"
      onCancel={onCancel}
      onClick={(e) => {
        if (e.target === ref.current) onCancel()
      }}
    >
      <div onClick={(e) => e.stopPropagation()} className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-ink">Where should they collect it?</h2>
        <p className="text-sm text-muted">
          This is shared with the other party once you accept, so they know where to meet you.
        </p>

        {defaultAddress && (
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Pickup address</legend>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="pickup-choice"
                checked={useDefault}
                onChange={() => setUseDefault(true)}
              />
              <span>
                <span className="font-semibold text-ink">Use my saved address</span>
                <span className="block text-muted">{formatAddress(defaultAddress)}</span>
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="pickup-choice"
                checked={!useDefault}
                onChange={() => setUseDefault(false)}
              />
              <span className="font-semibold text-ink">Enter a different address</span>
            </label>
          </fieldset>
        )}

        {!(defaultAddress && useDefault) && (
          <div className="flex flex-col gap-3">
            {FIELDS.map((field) => (
              <div key={field.key}>
                <label htmlFor={field.key} className="field-label">
                  {field.label}
                </label>
                <input
                  id={field.key}
                  type="text"
                  className="field"
                  autoComplete="off"
                  value={draft[field.key]}
                  onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn btn-soft">
            Cancel
          </button>
          <button
            type="button"
            disabled={!complete || busy}
            onClick={() => onSubmit(chosen)}
            className="btn btn-accent"
          >
            {busy ? 'Accepting…' : 'Accept request'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
