'use client'
/**
 * Web counterpart to mobile's three profile screens plus hub —
 * packages/mobile/components/profile/{ability,everyday-needs,customization}-screen.tsx
 * and child-profile-home.tsx. React Native components cannot be reused, so this is a
 * re-implementation against the same PUT /api/child-profile contract and the same
 * ChildProfile type from @splat-connect/types.
 *
 * This component builds the shell, the save path, and the Ability Profile section
 * only — Everyday Needs and Customization Metrics are added in a later task, but the
 * state they'll fill in (challenges, sensory_preferences, needs_arm_attachment) is
 * already initialised here so a save from this task never violates their NOT NULL
 * column defaults.
 *
 * Deliberately does NOT port:
 * - Mobile's autosave: a phone can be backgrounded mid-edit, a browser tab cannot, so
 *   an explicit Save is less machinery for the same safety. PUT /api/child-profile is
 *   already an upsert, so create and update are the same call.
 * - The MACS/BFMF estimator behind "Answer a few simple questions instead"
 *   (ability-screen.tsx:117). Values are entered directly here, so macs_source and
 *   bfmf_source stay 'manual'.
 *
 * Error handling matches terms-gate.tsx and profile-form.tsx: a failed save shows a
 * role="alert" message and does NOT show a saved indicator, since telling the user a
 * change was recorded when the server never recorded it leaves them confused later.
 *
 * Related files:
 * - packages/api routes backing PUT /api/child-profile
 * - supabase/migrations/003_ability_profile.sql: the column groupings this form follows
 */
import { useState } from 'react'
import { browserApiClient } from '@/lib/browser-api-client'
import type { ChildProfile } from '@splat-connect/types'

const MACS_LEVELS = ['I', 'II', 'III', 'IV', 'V']
const BFMF_SCORES = ['1', '2', '3', '4', '5']

export function ChildProfileForm({ profile }: { profile: ChildProfile | null }) {
  const [form, setForm] = useState<Partial<ChildProfile>>(() => ({
    age: profile?.age ?? null,
    primary_diagnosis: profile?.primary_diagnosis ?? null,
    macs_level: profile?.macs_level ?? null,
    macs_source: profile?.macs_source ?? 'manual',
    hand_involvement: profile?.hand_involvement ?? null,
    assist_hand: profile?.assist_hand ?? null,
    bfmf_score: profile?.bfmf_score ?? null,
    bfmf_source: profile?.bfmf_source ?? 'manual',
    // Everyday Needs / Customization Metrics: no controls yet (task 7), but these
    // columns are NOT NULL so the save below must never send null for them.
    challenges: profile?.challenges ?? [],
    sensory_preferences: profile?.sensory_preferences ?? [],
    needs_arm_attachment: profile?.needs_arm_attachment ?? false,
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function set<K extends keyof ChildProfile>(key: K, value: ChildProfile[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      await browserApiClient.put('/api/child-profile', form)
      setSaved(true)
    } catch {
      setError('Could not save your changes. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="card flex max-w-xl flex-col gap-4 p-6">
      <h2 className="text-lg font-bold text-ink">Ability profile</h2>

      <div>
        <label htmlFor="age" className="field-label">Age</label>
        <input
          id="age"
          type="number"
          value={form.age ?? ''}
          onChange={(e) => set('age', e.target.value === '' ? null : Number(e.target.value))}
          className="field"
        />
      </div>

      <div>
        <label htmlFor="primary_diagnosis" className="field-label">Primary diagnosis</label>
        <input
          id="primary_diagnosis"
          type="text"
          value={form.primary_diagnosis ?? ''}
          onChange={(e) => set('primary_diagnosis', e.target.value || null)}
          className="field"
        />
      </div>

      <div>
        <label htmlFor="macs_level" className="field-label">MACS level</label>
        <select
          id="macs_level"
          value={form.macs_level ?? ''}
          onChange={(e) => set('macs_level', e.target.value || null)}
          className="field"
        >
          <option value="">Not set</option>
          {MACS_LEVELS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="bfmf_score" className="field-label">BFMF score</label>
        <select
          id="bfmf_score"
          value={form.bfmf_score ?? ''}
          onChange={(e) => set('bfmf_score', e.target.value || null)}
          className="field"
        >
          <option value="">Not set</option>
          {BFMF_SCORES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="hand_involvement" className="field-label">Hand involvement</label>
        <select
          id="hand_involvement"
          value={form.hand_involvement ?? ''}
          onChange={(e) =>
            set('hand_involvement', (e.target.value || null) as ChildProfile['hand_involvement'])
          }
          className="field"
        >
          <option value="">Not set</option>
          <option value="bilateral">Bilateral</option>
          <option value="unilateral">Unilateral</option>
        </select>
      </div>

      <div>
        <label htmlFor="assist_hand" className="field-label">Assist hand</label>
        <select
          id="assist_hand"
          value={form.assist_hand ?? ''}
          onChange={(e) => set('assist_hand', (e.target.value || null) as ChildProfile['assist_hand'])}
          className="field"
        >
          <option value="">Not set</option>
          <option value="left">Left</option>
          <option value="right">Right</option>
        </select>
      </div>

      {error && <p role="alert" className="alert alert-danger">{error}</p>}
      {saved && <p className="text-sm font-semibold text-mint-deep">Saved</p>}
      <button type="submit" disabled={busy} className="btn btn-accent mt-2">
        {busy ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
