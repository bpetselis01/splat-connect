'use client'
import { PanelActions, useSaveOnLeave } from '@/components/panel-actions'
import { useState } from 'react'
import { useSave } from '@/components/use-save'
import type { Toy } from '@splat-connect/types'

type Facts = Pick<Toy, 'age_min' | 'age_max' | 'batteries' | 'switch_fitting' | 'volume' | 'tutorial_id'>
export type ToyDetailsInput = { name: string; description: string | null; condition: number } & Facts

const TEXT_FACTS = [
  { key: 'batteries', label: 'Batteries', placeholder: 'e.g. 2 × AA, included', max: 60 },
  { key: 'switch_fitting', label: 'Switch fitting', placeholder: 'e.g. 3.5 mm mono socket', max: 60 },
  { key: 'volume', label: 'Volume', placeholder: 'e.g. Loud, half-taped', max: 40 },
] as const

const numOrNull = (v: string) => (v === '' ? null : Number(v))
const str = (v: number | null | undefined) => (v == null ? '' : String(v))

export function ToyDetailsForm({
  toy,
  guides = [],
  onSave,
}: {
  toy: { name: string; description: string | null; condition: number } & Facts
  /** Approved guides, for "Built from a guide?". */
  guides?: { id: string; title: string }[]
  onSave: (form: ToyDetailsInput) => Promise<void>
}) {
  const [name, setName] = useState(toy.name)
  const [description, setDescription] = useState(toy.description ?? '')
  const [condition, setCondition] = useState(toy.condition)
  const [ageMin, setAgeMin] = useState(str(toy.age_min))
  const [ageMax, setAgeMax] = useState(str(toy.age_max))
  const [text, setText] = useState({
    batteries: toy.batteries ?? '',
    switch_fitting: toy.switch_fitting ?? '',
    volume: toy.volume ?? '',
  })
  const [guideId, setGuideId] = useState(toy.tutorial_id ?? '')
  const { busy, error, saved, run } = useSave(onSave)

  async function save(e?: React.FormEvent) {
    e?.preventDefault()
    return run({
      name,
      description: description === '' ? null : description,
      condition,
      age_min: numOrNull(ageMin),
      age_max: numOrNull(ageMax),
      batteries: text.batteries.trim() || null,
      switch_fitting: text.switch_fitting.trim() || null,
      volume: text.volume.trim() || null,
      tutorial_id: guideId || null,
    })
  }

  /* Leaving the step saves it. Dirty is a comparison against the toy as loaded
     rather than a flag set on the first keystroke: these fields are controlled,
     so typing a character and typing it back out leaves nothing to write, and
     an empty name is something the API refuses anyway. */
  const dirty =
    name !== toy.name ||
    description !== (toy.description ?? '') ||
    condition !== toy.condition ||
    ageMin !== str(toy.age_min) ||
    ageMax !== str(toy.age_max) ||
    TEXT_FACTS.some((f) => text[f.key] !== (toy[f.key] ?? '')) ||
    guideId !== (toy.tutorial_id ?? '')
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
      <fieldset className="m-0 border-0 p-0">
        <legend className="field-label">Ages it suits</legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="toy-age-min" className="text-xs text-muted">From age</label>
            <input
              id="toy-age-min"
              type="number"
              min={0}
              max={18}
              value={ageMin}
              onChange={(e) => setAgeMin(e.target.value)}
              className="field"
            />
          </div>
          <div>
            <label htmlFor="toy-age-max" className="text-xs text-muted">To age</label>
            <input
              id="toy-age-max"
              type="number"
              min={ageMin === '' ? 0 : Number(ageMin)}
              max={18}
              value={ageMax}
              onChange={(e) => setAgeMax(e.target.value)}
              className="field"
            />
          </div>
        </div>
      </fieldset>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {TEXT_FACTS.map((f) => (
          <div key={f.key}>
            <label htmlFor={`toy-${f.key}`} className="field-label">{f.label}</label>
            <input
              id={`toy-${f.key}`}
              type="text"
              maxLength={f.max}
              placeholder={f.placeholder}
              value={text[f.key]}
              onChange={(e) => setText((t) => ({ ...t, [f.key]: e.target.value }))}
              className="field"
            />
          </div>
        ))}
      </div>
      <div>
        <label htmlFor="toy-guide" className="field-label">
          Built from a guide? <span className="font-semibold text-muted">(optional)</span>
        </label>
        <select id="toy-guide" value={guideId} onChange={(e) => setGuideId(e.target.value)} className="field">
          <option value="">No guide</option>
          {/* A linked guide that has since left the library still shows, so
              saving the form does not silently unlink it. */}
          {guideId && !guides.some((g) => g.id === guideId) && (
            <option value={guideId}>A guide no longer in the library</option>
          )}
          {guides.map((g) => (
            <option key={g.id} value={g.id}>{g.title}</option>
          ))}
        </select>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Linked, so a family can see how it was made — and make their own.
        </p>
      </div>
      <PanelActions>
        <button type="submit" disabled={busy} className="btn btn-accent">
          {busy ? 'Saving…' : 'Save'}
        </button>
        {error && <p role="alert" className="alert alert-danger">{error}</p>}
        {saved && <p className="text-sm font-semibold text-ink">Saved</p>}
      </PanelActions>
    </form>
  )
}
