'use client'
/**
 * Account settings. Only `name` is editable: `role` and `email` are frozen by
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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      await browserApiClient.patch('/api/contributors/me', { name })
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
      {error && <p role="alert" className="alert alert-danger">{error}</p>}
      {saved && <p className="text-sm font-semibold text-mint-deep">Saved</p>}
      <button type="submit" disabled={busy} className="btn btn-accent mt-2">
        {busy ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
