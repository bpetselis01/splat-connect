'use client'
import { PanelActions, useSaveOnLeave } from '@/components/panel-actions'
import { useState } from 'react'
import { useSave } from '@/components/use-save'

export function ToyDetailsForm({
  toy,
  onSave,
}: {
  toy: { name: string; description: string | null; condition: number }
  onSave: (form: { name: string; description: string | null; condition: number }) => Promise<void>
}) {
  const [name, setName] = useState(toy.name)
  const [description, setDescription] = useState(toy.description ?? '')
  const [condition, setCondition] = useState(toy.condition)
  const { busy, error, saved, run } = useSave(onSave)

  async function save(e?: React.FormEvent) {
    e?.preventDefault()
    return run({ name, description: description === '' ? null : description, condition })
  }

  /* Leaving the step saves it. Dirty is a comparison against the toy as loaded
     rather than a flag set on the first keystroke: these fields are controlled,
     so typing a character and typing it back out leaves nothing to write, and
     an empty name is something the API refuses anyway. */
  const dirty =
    name !== toy.name ||
    description !== (toy.description ?? '') ||
    condition !== toy.condition
  useSaveOnLeave(dirty && name.trim() !== '' && !busy ? () => save() : null)

  return (
    <form onSubmit={save} className="flex flex-col gap-4 px-5 pb-5">
      <div>
        <label htmlFor="toy-name" className="field-label">Name</label>
        <input
          id="toy-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="field"
          required
        />
      </div>
      <div>
        <label htmlFor="toy-condition" className="field-label">Condition (1–10)</label>
        <input
          id="toy-condition"
          type="number"
          min={1}
          max={10}
          value={condition}
          onChange={(e) => setCondition(Number(e.target.value))}
          className="field"
          required
        />
        <p className="mt-1 text-xs leading-relaxed text-muted">
          10 means brand new, 1 means heavily worn — scuffed, faded or missing pieces.
        </p>
      </div>
      <div>
        <label htmlFor="toy-description" className="field-label">Description</label>
        <textarea
          id="toy-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="field"
          rows={4}
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
