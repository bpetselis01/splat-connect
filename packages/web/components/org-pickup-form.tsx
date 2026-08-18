'use client'
/**
 * An organisation's fixed pickup point.
 *
 * Not a convenience: without a complete address the accept handler refuses
 * every request, so this form is what turns an organisation's shelf from a
 * catalogue into something a family can actually collect.
 *
 * Unlike the peer-to-peer flow, where an owner types an address as they accept,
 * this is set once and cannot be varied per handoff — an association meets
 * people at its building.
 */
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { browserApiClient } from '@/lib/browser-api-client'

export type OrgPickup = {
  pickup_line1: string | null
  pickup_suburb: string | null
  pickup_state: string | null
  pickup_postcode: string | null
  pickup_instructions: string | null
}

export function OrgPickupForm({ orgId, pickup }: { orgId: string; pickup: OrgPickup }) {
  const router = useRouter()
  const [line1, setLine1] = useState(pickup.pickup_line1 ?? '')
  const [suburb, setSuburb] = useState(pickup.pickup_suburb ?? '')
  const [state, setState] = useState(pickup.pickup_state ?? '')
  const [postcode, setPostcode] = useState(pickup.pickup_postcode ?? '')
  const [instructions, setInstructions] = useState(pickup.pickup_instructions ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      await browserApiClient.patch(`/api/organizations/${orgId}/pickup`, {
        pickup_line1: line1,
        pickup_suburb: suburb,
        pickup_state: state,
        pickup_postcode: postcode,
        pickup_instructions: instructions || null,
      })
      setSaved(true)
      router.refresh()
    } catch {
      setError('Could not save the pickup details. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div>
        <label htmlFor={`pickup-line1-${orgId}`} className="field-label">Street address</label>
        <input
          id={`pickup-line1-${orgId}`}
          type="text"
          value={line1}
          onChange={(e) => setLine1(e.target.value)}
          required
          className="field"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor={`pickup-suburb-${orgId}`} className="field-label">Suburb</label>
          <input
            id={`pickup-suburb-${orgId}`}
            type="text"
            value={suburb}
            onChange={(e) => setSuburb(e.target.value)}
            required
            className="field"
          />
        </div>
        <div>
          <label htmlFor={`pickup-state-${orgId}`} className="field-label">State</label>
          <input
            id={`pickup-state-${orgId}`}
            type="text"
            value={state}
            onChange={(e) => setState(e.target.value)}
            required
            className="field"
          />
        </div>
        <div>
          <label htmlFor={`pickup-postcode-${orgId}`} className="field-label">Postcode</label>
          <input
            id={`pickup-postcode-${orgId}`}
            type="text"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            required
            className="field"
          />
        </div>
      </div>

      <div>
        <label htmlFor={`pickup-instructions-${orgId}`} className="field-label">
          Pickup instructions <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id={`pickup-instructions-${orgId}`}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={3}
          className="field"
        />
        <p className="mt-1 text-xs text-muted">
          Shown to a family only once you accept their request — where to park, which door, who to
          ask for.
        </p>
      </div>

      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}
      {saved && !error && <p className="text-sm font-bold text-mint-deep">Pickup details saved.</p>}

      <button type="submit" disabled={busy} className="btn btn-accent self-start">
        {busy ? 'Saving…' : 'Save pickup details'}
      </button>
    </form>
  )
}
