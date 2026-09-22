'use client'
/**
 * Account settings. `name`, pickup address fields, `public_showcase`, `bio` and
 * `featured_tutorial_id` are editable: `role` and `email` are frozen by
 * the profiles_freeze_identity trigger (009), so offering fields for them would
 * promise something the database refuses.
 *
 * Deliberately does not set `saved` on a failed request — see terms-gate.tsx
 * for the same rule stated about its own request: telling the user a change
 * was recorded when the server never recorded it leaves them confused later.
 * That rule now lives in components/use-save.ts, which every panel form shares.
 *
 * Related files:
 * - packages/api/src/routes/contributors.ts: PATCH /api/contributors/me
 */
import { useState } from 'react'
import { useSave } from '@/components/use-save'
import { browserApiClient } from '@/lib/browser-api-client'
import type { ReactNode } from 'react'
import type { Profile } from '@splat-connect/types'

// The board's account fields: 50px on --canvas, a step taller than .field.
const FIELD = 'field min-h-[50px] bg-canvas'

/** `badges` renders under the email — the account's role and agreement chips,
    which the page fetches and this form only places. */
export function ProfileForm({
  profile,
  badges,
  publishedGuides = [],
}: {
  profile: Profile
  badges?: ReactNode
  /** The caller's approved guides, for the featured pick (072). The API
   *  refuses any other id, so only offer what it will take. */
  publishedGuides?: { id: string; title: string }[]
}) {
  const [name, setName] = useState(profile.name)
  const [bio, setBio] = useState(profile.bio ?? '')
  const [featured, setFeatured] = useState(profile.featured_tutorial_id ?? '')
  const [pickupLine1, setPickupLine1] = useState(profile.pickup_line1 || '')
  const [pickupSuburb, setPickupSuburb] = useState(profile.pickup_suburb || '')
  const [pickupState, setPickupState] = useState(profile.pickup_state || '')
  const [pickupPostcode, setPickupPostcode] = useState(profile.pickup_postcode || '')
  const [publicShowcase, setPublicShowcase] = useState(profile.public_showcase)
  const { busy, error, saved, run } = useSave((body: unknown) =>
    browserApiClient.patch('/api/contributors/me', body),
  )

  async function save(e: React.FormEvent) {
    e.preventDefault()
    await run({
      name,
      pickup_line1: pickupLine1,
      pickup_suburb: pickupSuburb,
      pickup_state: pickupState,
      pickup_postcode: pickupPostcode,
      public_showcase: publicShowcase,
      bio: bio.trim() || null,
      featured_tutorial_id: featured || null,
    })
  }

  return (
    <form
      onSubmit={save}
      className="flex flex-col gap-5 rounded-[24px] border border-line bg-surface p-7 shadow-e2"
    >
      <div>
        <label htmlFor="name" className="field-label">Display name</label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={FIELD}
        />
      </div>
      <div>
        <label htmlFor="email" className="field-label">Email</label>
        <input
          id="email"
          type="email"
          readOnly
          value={profile.email}
          className="field min-h-[50px] bg-sunken text-muted"
        />
        <p className="mt-[7px] text-[13px] text-muted">Frozen. Contact us if you need it changed.</p>
      </div>
      {badges}
      {/* The public profile's About paragraph and featured guide (072). Shown
          under the identity fields because that is where the board draws them
          on /contributors/[id]: right under the name. */}
      <div className="flex flex-col gap-3 border-t border-line pt-4">
        <div>
          <label htmlFor="bio" className="field-label">About you</label>
          <textarea
            id="bio"
            rows={4}
            maxLength={600}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className={`${FIELD} resize-y`}
            placeholder="What you adapt, and why. Shown on your public profile."
          />
          <p className="mt-[7px] text-[13px] text-muted">{bio.length}/600</p>
        </div>
        {publishedGuides.length > 0 && (
          <div>
            <label htmlFor="featured-guide" className="field-label">Featured guide</label>
            <select
              id="featured-guide"
              value={featured}
              onChange={(e) => setFeatured(e.target.value)}
              className={FIELD}
            >
              <option value="">None</option>
              {publishedGuides.map((g) => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </select>
            <p className="mt-[7px] text-[13px] text-muted">The one you would hand a first-timer.</p>
          </div>
        )}
      </div>
      {/* A field group inside the account card, not a page section: the board
          draws Account as one form with no second heading in it, and the <h2>
          that used to sit here read as a sibling of "Child profiles" below.
          Every input below carries its own <label>, so the group only needs a
          visual lead-in. */}
      <div className="flex flex-col gap-3 border-t border-line pt-4">
        <p className="field-label mb-0">Default pickup address</p>
        <p className="text-xs text-muted">Offered as the default when you accept a donation or exchange request. You can send a different address instead.</p>
        <div>
          <label htmlFor="pickup-line1" className="field-label">Address line</label>
          <input id="pickup-line1" className={FIELD} value={pickupLine1} onChange={(e) => setPickupLine1(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <div>
            <label htmlFor="pickup-suburb" className="field-label">Suburb</label>
            <input id="pickup-suburb" className={FIELD} value={pickupSuburb} onChange={(e) => setPickupSuburb(e.target.value)} />
          </div>
          <div>
            <label htmlFor="pickup-state" className="field-label">State</label>
            <input id="pickup-state" className={FIELD} value={pickupState} onChange={(e) => setPickupState(e.target.value)} />
          </div>
          <div>
            <label htmlFor="pickup-postcode" className="field-label">Postcode</label>
            <input id="pickup-postcode" className={FIELD} value={pickupPostcode} onChange={(e) => setPickupPostcode(e.target.value)} />
          </div>
        </div>
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
      {saved && <p className="text-sm font-semibold text-ink">Saved</p>}
      <button type="submit" disabled={busy} className="btn btn-primary self-start">
        {busy ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  )
}
