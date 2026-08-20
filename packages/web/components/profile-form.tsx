'use client'
/**
 * Account settings. `name`, pickup address fields, and `public_showcase` are editable: `role` and `email` are frozen by
 * the profiles_freeze_identity trigger (009), so offering fields for them would
 * promise something the database refuses.
 *
 * Deliberately does not set `saved` on a failed request — see terms-gate.tsx
 * for the same rule stated about its own request: telling the user a change
 * was recorded when the server never recorded it leaves them confused later.
 *
 * Related files:
 * - packages/api/src/routes/contributors.ts: PATCH /api/contributors/me
 */
import { useState } from 'react'
import { browserApiClient } from '@/lib/browser-api-client'
import type { Profile } from '@splat-connect/types'

export function ProfileForm({ profile }: { profile: Profile }) {
  const [name, setName] = useState(profile.name)
  const [pickupLine1, setPickupLine1] = useState(profile.pickup_line1 || '')
  const [pickupSuburb, setPickupSuburb] = useState(profile.pickup_suburb || '')
  const [pickupState, setPickupState] = useState(profile.pickup_state || '')
  const [pickupPostcode, setPickupPostcode] = useState(profile.pickup_postcode || '')
  const [publicShowcase, setPublicShowcase] = useState(profile.public_showcase)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      await browserApiClient.patch('/api/contributors/me', {
        name,
        pickup_line1: pickupLine1,
        pickup_suburb: pickupSuburb,
        pickup_state: pickupState,
        pickup_postcode: pickupPostcode,
        public_showcase: publicShowcase,
      })
      setSaved(true)
    } catch {
      setError('Could not save your changes. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="card flex max-w-sm flex-col gap-4 p-6">
      <div>
        <label htmlFor="name" className="field-label">Full name</label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="field"
        />
      </div>
      <div>
        <label htmlFor="email" className="field-label">Email</label>
        <input id="email" type="email" readOnly value={profile.email} className="field" />
        <p className="mt-1.5 text-xs text-muted">
          Your email is tied to your sign-in and cannot be changed here.
        </p>
      </div>
      <div className="flex flex-col gap-3 border-t border-line pt-4">
        <h2 className="text-sm font-semibold text-ink">Default pickup address</h2>
        <p className="text-xs text-muted">Offered as the default when you accept a donation or exchange request. You can send a different address instead.</p>
        <label htmlFor="pickup-line1" className="field-label">Address line</label>
        <input id="pickup-line1" className="field" value={pickupLine1} onChange={(e) => setPickupLine1(e.target.value)} />
        <label htmlFor="pickup-suburb" className="field-label">Suburb</label>
        <input id="pickup-suburb" className="field" value={pickupSuburb} onChange={(e) => setPickupSuburb(e.target.value)} />
        <label htmlFor="pickup-state" className="field-label">State</label>
        <input id="pickup-state" className="field" value={pickupState} onChange={(e) => setPickupState(e.target.value)} />
        <label htmlFor="pickup-postcode" className="field-label">Postcode</label>
        <input id="pickup-postcode" className="field" value={pickupPostcode} onChange={(e) => setPickupPostcode(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1 border-t border-line pt-4">
        <label htmlFor="public-showcase" className="flex items-center gap-2 text-sm">
          <input
            id="public-showcase"
            type="checkbox"
            checked={publicShowcase}
            onChange={(e) => setPublicShowcase(e.target.checked)}
          />
          Show my contributions publicly
        </label>
        <p className="text-xs text-muted">Your name still appears on tutorials you&apos;re credited on.</p>
      </div>
      {error && <p role="alert" className="alert alert-danger">{error}</p>}
      {saved && <p className="text-sm font-semibold text-mint-deep">Saved</p>}
      <button type="submit" disabled={busy} className="btn btn-accent mt-2">
        {busy ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
