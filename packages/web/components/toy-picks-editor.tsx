'use client'
/**
 * "Also worth a look" for one of your toys (102): automatic — your other
 * listed toys, newest first — or up to three you pick from your own listed
 * toys and published guides.
 */
import { useState } from 'react'
import {
  initialPicks,
  MAX_PICKS,
  pickOptions,
  samePick,
  type PicksMode,
  type Toy,
  type ToyPickInput,
} from '@splat-connect/types'
import { browserApiClient } from '@/lib/browser-api-client'

export function ToyPicksEditor({
  toy,
  ownToys,
  guides,
  onSaved,
}: {
  toy: Toy
  /** The holder's shelf; only their other listed toys can be picked. */
  ownToys: Toy[]
  guides: { id: string; title: string }[]
  onSaved: (toy: Toy) => void
}) {
  const [picks, setPicks] = useState<ToyPickInput[]>(() => initialPicks(toy))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mode: PicksMode = toy.picks_mode ?? 'auto'

  // One request at a time: a second PUT racing the first clashes on
  // (toy_id, position) and reports a failure for picks that did save.
  async function run(action: () => Promise<void>, fallback: string) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch {
      setError(fallback)
    } finally {
      setBusy(false)
    }
  }

  const setMode = (next: PicksMode) =>
    next === mode
      ? undefined
      : run(
          async () => onSaved(await browserApiClient.patch<Toy>(`/api/toys/${toy.id}`, { picks_mode: next })),
          'Could not save that. Please try again.'
        )

  const save = () =>
    run(async () => {
      await browserApiClient.put(`/api/toys/${toy.id}/picks`, { picks })
      onSaved({ ...toy, toy_picks: picks.map((p, i) => ({ position: i + 1, ...p })) })
    }, 'Could not save your picks. Please try again.')

  return (
    <div>
      <h3 className="editor-h3">Also worth a look</h3>
      <div role="radiogroup" aria-label="Also worth a look" className="flex flex-wrap gap-2.5">
        {(['auto', 'picked'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            disabled={busy}
            onClick={() => setMode(m)}
            className="kind-card px-4 py-2.5 font-bold"
          >
            {m === 'auto' ? 'Automatic' : 'Hand-picked'}
          </button>
        ))}
      </div>
      {mode === 'picked' && (
        <div className="mt-3 flex flex-col gap-2">
          {pickOptions(toy, ownToys, guides).map((o) => {
            const on = picks.some((p) => samePick(p, o.pick))
            return (
              <label key={`${o.pick.entity_type}:${o.pick.entity_id}`} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={on}
                  disabled={!on && picks.length >= MAX_PICKS}
                  onChange={() => setPicks((cur) => (on ? cur.filter((p) => !samePick(p, o.pick)) : [...cur, o.pick]))}
                />
                {o.label}
              </label>
            )
          })}
          <button type="button" disabled={busy} onClick={save} className="btn btn-primary self-start">
            Save picks
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm font-bold text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
