'use client'
import { PanelActions } from '@/components/panel-actions'
import { useState } from 'react'
import type { ChildProfile } from '@splat-connect/types'

const SENSORY_PREFERENCES = ['Soft', 'Firm', 'Smooth', 'Textured', 'Lightweight', 'No preference']

type Fields = Pick<
  ChildProfile,
  | 'palm_width_mm'
  | 'wrist_circ_mm'
  | 'forearm_length_mm'
  | 'hand_dominance'
  | 'needs_arm_attachment'
  | 'sensory_preferences'
>

export function ChildCustomizationForm({
  profile,
  onSave,
}: {
  profile: ChildProfile | null
  onSave: (fields: Partial<ChildProfile>) => Promise<void>
}) {
  const [form, setForm] = useState<Fields>({
    palm_width_mm: profile?.palm_width_mm ?? null,
    wrist_circ_mm: profile?.wrist_circ_mm ?? null,
    forearm_length_mm: profile?.forearm_length_mm ?? null,
    hand_dominance: profile?.hand_dominance ?? null,
    needs_arm_attachment: profile?.needs_arm_attachment ?? false,
    sensory_preferences: profile?.sensory_preferences ?? [],
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // An untouched number field means "not measured", not "measured as zero" — sending 0
  // for e.g. an unmeasured palm width would be a lie in the data, so it stays null.
  function setNumber(key: 'palm_width_mm' | 'wrist_circ_mm' | 'forearm_length_mm', raw: string) {
    set(key, raw === '' ? null : Number(raw))
  }

  function toggleSensory(value: string) {
    setForm((prev) => ({
      ...prev,
      sensory_preferences: prev.sensory_preferences.includes(value)
        ? prev.sensory_preferences.filter((v) => v !== value)
        : [...prev.sensory_preferences, value],
    }))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      await onSave(form)
      setSaved(true)
    } catch {
      setError('Could not save your changes. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4 px-5 pb-5">
      <p className="text-sm leading-relaxed text-muted">
        Hand measurements and sensory preferences, used to fit and finish toys for
        your child.
      </p>
      <div className="grid grid-cols-3 gap-3">
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
          <label htmlFor="wrist_circ_mm" className="field-label">Wrist circ. (mm)</label>
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
          <label htmlFor="forearm_length_mm" className="field-label">Forearm (mm)</label>
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
      </div>

      <div className="grid grid-cols-2 gap-4">
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

        <div className="flex items-end pb-2">
          <label htmlFor="needs_arm_attachment" className="flex items-center gap-2">
            <input
              id="needs_arm_attachment"
              type="checkbox"
              checked={form.needs_arm_attachment}
              onChange={(e) => set('needs_arm_attachment', e.target.checked)}
            />
            Needs an arm attachment
          </label>
        </div>
      </div>

      <div>
        <span className="field-label">Sensory preferences</span>
        <div className="flex flex-col gap-1">
          {SENSORY_PREFERENCES.map((s) => (
            <label key={s} htmlFor={`sensory-${s}`} className="flex items-center gap-2">
              <input
                id={`sensory-${s}`}
                type="checkbox"
                checked={form.sensory_preferences.includes(s)}
                onChange={() => toggleSensory(s)}
              />
              {s}
            </label>
          ))}
        </div>
      </div>

      <PanelActions>
        <button type="submit" disabled={busy} className="btn btn-accent">
          {busy ? 'Saving…' : 'Save'}
        </button>
        {error && <p role="alert" className="alert alert-danger">{error}</p>}
        {saved && <p className="text-sm font-semibold text-mint-deep">Saved</p>}
      </PanelActions>
    </form>
  )
}
