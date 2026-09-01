'use client'
import { PanelActions } from '@/components/panel-actions'
import { useState } from 'react'
import { useSave } from '@/components/use-save'
import type { ChildProfile } from '@splat-connect/types'

const MACS_LEVELS = ['I', 'II', 'III', 'IV', 'V']
const BFMF_SCORES = ['1', '2', '3', '4', '5']

type Fields = Pick<
  ChildProfile,
  | 'name'
  | 'age'
  | 'macs_level'
  | 'macs_source'
  | 'bfmf_score'
  | 'bfmf_source'
  | 'hand_involvement'
  | 'assist_hand'
>

export function ChildAbilityForm({
  profile,
  onSave,
}: {
  profile: ChildProfile | null
  onSave: (fields: Partial<ChildProfile>) => Promise<void>
}) {
  const [form, setForm] = useState<Fields>({
    name: profile?.name ?? null,
    age: profile?.age ?? null,
    macs_level: profile?.macs_level ?? null,
    macs_source: profile?.macs_source ?? 'manual',
    bfmf_score: profile?.bfmf_score ?? null,
    bfmf_source: profile?.bfmf_source ?? 'manual',
    hand_involvement: profile?.hand_involvement ?? null,
    assist_hand: profile?.assist_hand ?? null,
  })
  const { busy, error, saved, run } = useSave(onSave)

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    await run(form)
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4 px-5 pb-5">
      <p className="text-sm leading-relaxed text-muted">
        Basic info about your child and their hand movement, so we can suggest toys
        that fit how they play.
      </p>
      <div>
        <label htmlFor="name" className="field-label">Name (optional)</label>
        <input
          id="name"
          type="text"
          value={form.name ?? ''}
          onChange={(e) => set('name', e.target.value === '' ? null : e.target.value)}
          className="field"
        />
      </div>

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

      <details className="group">
        <summary className="field-label cursor-pointer select-none">Clinical scores (optional)</summary>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          If an occupational therapist or paediatrician has given you a MACS or BFMF
          level, you can enter it here and we&apos;ll use it instead of our own estimate.
          Leave this blank if you&apos;re not sure — you don&apos;t need it.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="macs_level" className="field-label">MACS level</label>
          <select
            id="macs_level"
            value={form.macs_level ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, macs_level: e.target.value || null, macs_source: 'manual' }))}
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
            onChange={(e) => setForm((prev) => ({ ...prev, bfmf_score: e.target.value || null, bfmf_source: 'manual' }))}
            className="field"
          >
            <option value="">Not set</option>
            {BFMF_SCORES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        </div>
      </details>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="hand_involvement" className="field-label">Hand involvement</label>
          <select
            id="hand_involvement"
            value={form.hand_involvement ?? ''}
            onChange={(e) => set('hand_involvement', (e.target.value || null) as ChildProfile['hand_involvement'])}
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
