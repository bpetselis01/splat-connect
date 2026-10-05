'use client'
/**
 * "Who it suits" (127), on the guide editor and the toy editor: the board's
 * child questions, answered from the item's side. Movement, hands and play are
 * chip groups; each measurement is an optional from–to pair. None is required,
 * and an untagged item simply never matches those library filters.
 *
 * Saves itself through the browser client rather than a server action, so a
 * refused value arrives with the API's own sentence (a server action's error
 * text is redacted in production). A guide's PATCH wants updated_at as its
 * optimistic lock, so `lock` reads it first, the way the server pages do.
 */
import { useState } from 'react'
import {
  CHILD_MEASURES,
  ENJOYS,
  HANDS,
  MOVEMENTS,
  apiMessage,
  readSuits,
  type Suits,
} from '@splat-connect/types'
import { browserApiClient } from '@/lib/browser-api-client'

type Option = { value: string; label: string }
const GROUPS = [
  { key: 'movement', legend: 'Movement', options: MOVEMENTS as readonly Option[] },
  { key: 'hands', legend: 'Hands', options: HANDS as readonly Option[] },
  { key: 'play', legend: 'Play', options: ENJOYS as readonly Option[] },
] as const

type Text = Record<string, [string, string]>

export function EditSuitsSection({
  endpoint,
  suits,
  lock = false,
  onSaved,
}: {
  /** e.g. /api/toys/:id or /api/tutorials/:id */
  endpoint: string
  suits: Suits
  /** Read updated_at from the endpoint first and send it with the save. */
  lock?: boolean
  onSaved?: (updated: Suits) => void
}) {
  const [lists, setLists] = useState<Record<string, string[]>>({
    movement: suits.movement ?? [],
    hands: suits.hands ?? [],
    play: suits.play ?? [],
  })
  const [fit, setFit] = useState<Text>(() =>
    Object.fromEntries(CHILD_MEASURES.map((m) => [m.field, [String(suits.fit?.[m.field]?.[0] ?? ''), String(suits.fit?.[m.field]?.[1] ?? '')]]))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const edit = () => setSaved(false)
  const toggle = (key: string, value: string) => {
    edit()
    setLists((l) => ({ ...l, [key]: l[key].includes(value) ? l[key].filter((v) => v !== value) : [...l[key], value] }))
  }
  const setEnd = (field: string, end: 0 | 1, text: string) => {
    edit()
    setFit((f) => ({ ...f, [field]: end === 0 ? [text, f[field][1]] : [f[field][0], text] }))
  }

  async function save() {
    setError(null)
    const ranges: Record<string, number[]> = {}
    for (const m of CHILD_MEASURES) {
      const [lo, hi] = fit[m.field].map((t) => t.trim())
      if (!lo && !hi) continue
      if (!lo || !hi) return setError(`${m.label}: fill in both ends of the range, or neither.`)
      ranges[m.field] = [Number(lo), Number(hi)]
    }
    const body = {
      movement: lists.movement.length ? lists.movement : null,
      hands: lists.hands.length ? lists.hands : null,
      play: lists.play.length ? lists.play : null,
      fit: Object.keys(ranges).length ? ranges : null,
    }
    const checked = readSuits(body)
    if (typeof checked === 'string') return setError(checked)

    setSaving(true)
    try {
      const updated_at = lock ? (await browserApiClient.get<{ updated_at: string }>(endpoint)).updated_at : undefined
      const result = await browserApiClient.patch<Suits>(endpoint, lock ? { ...body, updated_at } : body)
      setSaved(true)
      onSaved?.(result)
    } catch (e) {
      setError(apiMessage(e, 'Could not save that. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="flex flex-col gap-4 px-5 pb-5" aria-labelledby="suits-h">
      <div>
        <h3 id="suits-h" className="field-label">Who it suits</h3>
        <p className="m-0 max-w-prose text-xs leading-relaxed text-muted">
          None of these are required. Filling them in helps families find it with the library filters.
        </p>
      </div>

      {GROUPS.map((g) => (
        <fieldset key={g.key} className="m-0 border-0 p-0">
          <legend className="field-label">{g.legend}</legend>
          <div className="flex flex-wrap gap-2">
            {g.options.map((o) => (
              <button
                key={o.value}
                type="button"
                className="chip"
                aria-pressed={lists[g.key].includes(o.value)}
                onClick={() => toggle(g.key, o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </fieldset>
      ))}

      {CHILD_MEASURES.map((m) => (
        <fieldset key={m.field} className="m-0 border-0 p-0">
          <legend className="field-label">{m.label}</legend>
          <div className="flex items-center gap-2">
            {(['From', 'To'] as const).map((word, end) => (
              <input
                key={word}
                type="number"
                inputMode="numeric"
                aria-label={`${m.label} ${word.toLowerCase()}`}
                placeholder={end === 0 ? `From ${m.min}` : `To ${m.max}`}
                min={m.min}
                max={m.max}
                value={fit[m.field][end]}
                onChange={(e) => setEnd(m.field, end as 0 | 1, e.target.value)}
                className="field max-w-[8rem]"
              />
            ))}
          </div>
        </fieldset>
      ))}

      {error && <p role="alert" className="alert alert-danger">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="button" disabled={saving} onClick={save} className="btn btn-primary btn-sm">
          {saving ? 'Saving…' : 'Save who it suits'}
        </button>
        {saved && <span role="status" className="text-sm font-semibold text-brand-dark">Saved</span>}
      </div>
    </section>
  )
}
