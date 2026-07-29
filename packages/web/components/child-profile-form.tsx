'use client'
/**
 * Web counterpart to mobile's three profile screens plus hub —
 * packages/mobile/components/profile/{ability,everyday-needs,customization}-screen.tsx
 * and child-profile-home.tsx. React Native components cannot be reused, so this is a
 * re-implementation against the same PUT /api/child-profile contract and the same
 * ChildProfile type from @splat-connect/types.
 *
 * This component covers all three sections mirrored from mobile's screens: Ability
 * Profile, Everyday Needs, and Customization Metrics — grouped in the markup the same
 * way supabase/migrations/003_ability_profile.sql groups the columns.
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
// Same vocabulary as mobile's everyday-needs-screen.tsx / customization-screen.tsx —
// this is the same DB column, so the value sets should match even though the control
// code isn't shared.
const CHALLENGES = ['Grasping', 'Holding', 'Fine motor', 'Strength', 'Coordination', 'Fatigue', 'Other']
const SENSORY_PREFERENCES = ['Soft', 'Firm', 'Smooth', 'Textured', 'Lightweight', 'No preference']

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
    // Every field rendered below must be seeded here, or it silently ignores
    // whatever the database holds and renders blank instead.
    challenges: profile?.challenges ?? [],
    challenge_other: profile?.challenge_other ?? null,
    grip_type: profile?.grip_type ?? null,
    env_context: profile?.env_context ?? null,
    sensory_preferences: profile?.sensory_preferences ?? [],
    needs_arm_attachment: profile?.needs_arm_attachment ?? false,
    palm_width_mm: profile?.palm_width_mm ?? null,
    wrist_circ_mm: profile?.wrist_circ_mm ?? null,
    forearm_length_mm: profile?.forearm_length_mm ?? null,
    hand_dominance: profile?.hand_dominance ?? null,
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function set<K extends keyof ChildProfile>(key: K, value: ChildProfile[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // challenges / sensory_preferences are text[] not null default '{}' — toggling here
  // always produces an array (possibly empty), never null.
  function toggle(key: 'challenges' | 'sensory_preferences', value: string) {
    setForm((prev) => {
      const current = prev[key] ?? []
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
      return { ...prev, [key]: next }
    })
  }

  // An untouched number field means "not measured", not "measured as zero" — sending 0
  // for e.g. an unmeasured palm width would be a lie in the data, so it stays null.
  function setNumber(key: 'palm_width_mm' | 'wrist_circ_mm' | 'forearm_length_mm', raw: string) {
    set(key, raw === '' ? null : Number(raw))
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

      <h2 className="text-lg font-bold text-ink">Everyday needs</h2>

      <div>
        <span className="field-label">Challenges</span>
        <div className="flex flex-col gap-1">
          {CHALLENGES.map((c) => (
            <label key={c} htmlFor={`challenge-${c}`} className="flex items-center gap-2">
              <input
                id={`challenge-${c}`}
                type="checkbox"
                checked={(form.challenges ?? []).includes(c)}
                onChange={() => toggle('challenges', c)}
              />
              {c}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="challenge_other" className="field-label">Other challenges</label>
        <input
          id="challenge_other"
          type="text"
          value={form.challenge_other ?? ''}
          onChange={(e) => set('challenge_other', e.target.value || null)}
          className="field"
        />
      </div>

      <div>
        <label htmlFor="grip_type" className="field-label">Grip type</label>
        <input
          id="grip_type"
          type="text"
          value={form.grip_type ?? ''}
          onChange={(e) => set('grip_type', e.target.value || null)}
          className="field"
        />
      </div>

      <div>
        <label htmlFor="env_context" className="field-label">Where it is used</label>
        <input
          id="env_context"
          type="text"
          value={form.env_context ?? ''}
          onChange={(e) => set('env_context', e.target.value || null)}
          className="field"
        />
      </div>

      <h2 className="text-lg font-bold text-ink">Customization metrics</h2>

      <div>
        <label htmlFor="palm_width_mm" className="field-label">Palm width (mm)</label>
        <input
          id="palm_width_mm"
          type="number"
          value={form.palm_width_mm ?? ''}
          onChange={(e) => setNumber('palm_width_mm', e.target.value)}
          step="any"
          min="0"
          className="field"
        />
      </div>

      <div>
        <label htmlFor="wrist_circ_mm" className="field-label">Wrist circumference (mm)</label>
        <input
          id="wrist_circ_mm"
          type="number"
          value={form.wrist_circ_mm ?? ''}
          onChange={(e) => setNumber('wrist_circ_mm', e.target.value)}
          step="any"
          min="0"
          className="field"
        />
      </div>

      <div>
        <label htmlFor="needs_arm_attachment" className="flex items-center gap-2">
          <input
            id="needs_arm_attachment"
            type="checkbox"
            checked={form.needs_arm_attachment ?? false}
            onChange={(e) => set('needs_arm_attachment', e.target.checked)}
          />
          Needs an arm attachment
        </label>
      </div>

      <div>
        <label htmlFor="forearm_length_mm" className="field-label">Forearm length (mm)</label>
        <input
          id="forearm_length_mm"
          type="number"
          value={form.forearm_length_mm ?? ''}
          onChange={(e) => setNumber('forearm_length_mm', e.target.value)}
          step="any"
          min="0"
          className="field"
        />
      </div>

      <div>
        <label htmlFor="hand_dominance" className="field-label">Hand dominance</label>
        <input
          id="hand_dominance"
          type="text"
          value={form.hand_dominance ?? ''}
          onChange={(e) => set('hand_dominance', e.target.value || null)}
          className="field"
        />
      </div>

      <div>
        <span className="field-label">Sensory preferences</span>
        <div className="flex flex-col gap-1">
          {SENSORY_PREFERENCES.map((s) => (
            <label key={s} htmlFor={`sensory-${s}`} className="flex items-center gap-2">
              <input
                id={`sensory-${s}`}
                type="checkbox"
                checked={(form.sensory_preferences ?? []).includes(s)}
                onChange={() => toggle('sensory_preferences', s)}
              />
              {s}
            </label>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="alert alert-danger">{error}</p>}
      {saved && <p className="text-sm font-semibold text-mint-deep">Saved</p>}
      <button type="submit" disabled={busy} className="btn btn-accent mt-2">
        {busy ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
