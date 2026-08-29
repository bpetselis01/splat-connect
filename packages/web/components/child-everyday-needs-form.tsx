'use client'
import { PanelActions } from '@/components/panel-actions'
import { useState } from 'react'
import { useSave } from '@/components/use-save'
import type { ChildProfile } from '@splat-connect/types'

const CHALLENGES = ['Grasping', 'Holding', 'Fine motor', 'Strength', 'Coordination', 'Fatigue', 'Other']

type Fields = Pick<ChildProfile, 'challenges' | 'challenge_other' | 'grip_type' | 'env_context'>

export function ChildEverydayNeedsForm({
  profile,
  onSave,
}: {
  profile: ChildProfile | null
  onSave: (fields: Partial<ChildProfile>) => Promise<void>
}) {
  const [form, setForm] = useState<Fields>({
    challenges: profile?.challenges ?? [],
    challenge_other: profile?.challenge_other ?? null,
    grip_type: profile?.grip_type ?? null,
    env_context: profile?.env_context ?? null,
  })
  const { busy, error, saved, run } = useSave(onSave)

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function toggleChallenge(value: string) {
    setForm((prev) => ({
      ...prev,
      challenges: prev.challenges.includes(value)
        ? prev.challenges.filter((v) => v !== value)
        : [...prev.challenges, value],
    }))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    await run(form)
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4 px-5 pb-5">
      <p className="text-sm leading-relaxed text-muted">
        What&apos;s tricky day-to-day, and where your child plays with toys most.
      </p>
      <div>
        <span className="field-label">Challenges</span>
        <div className="flex flex-col gap-1">
          {CHALLENGES.map((c) => (
            <label key={c} htmlFor={`challenge-${c}`} className="flex items-center gap-2">
              <input
                id={`challenge-${c}`}
                type="checkbox"
                checked={form.challenges.includes(c)}
                onChange={() => toggleChallenge(c)}
              />
              {c}
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
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
