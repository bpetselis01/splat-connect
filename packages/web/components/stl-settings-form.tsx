'use client'

/**
 * Per-file print settings on the editor's STL step (068): minutes on the bed,
 * grams of filament and the material, as the author sliced one copy. What a
 * family's request form sums into "3 h 10 min printing · 41 g PETG filament".
 *
 * One PATCH per changed row, never the replace-set POST: that deletes and
 * re-inserts every row, which a print job's `on delete restrict` refuses.
 */
import { useState, useTransition } from 'react'
import { STL_MATERIALS } from '@splat-connect/types'
import type { StlFile, StlMaterial } from '@splat-connect/types'
import { PanelActions } from '@/components/panel-actions'
import { useToast } from '@/components/toast'

export type StlSettings = Pick<StlFile, 'print_minutes' | 'filament_grams' | 'material'>

const settingsOf = (f: StlFile): StlSettings => ({
  print_minutes: f.print_minutes ?? null,
  filament_grams: f.filament_grams ?? null,
  material: f.material ?? null,
})
const same = (a: StlSettings, b: StlSettings) =>
  a.print_minutes === b.print_minutes && a.filament_grams === b.filament_grams && a.material === b.material

export function StlSettingsForm({
  files,
  onSave,
}: {
  files: StlFile[]
  onSave: (fileId: string, settings: StlSettings) => Promise<void>
}) {
  const showToast = useToast()
  const [draft, setDraft] = useState<Record<string, StlSettings>>(() =>
    Object.fromEntries(files.map((f) => [f.id, settingsOf(f)]))
  )
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const changed = files.filter((f) => !same(draft[f.id]!, settingsOf(f)))

  function set(id: string, patch: Partial<StlSettings>) {
    setDraft((d) => ({ ...d, [id]: { ...d[id]!, ...patch } }))
  }
  const num = (v: string) => (v === '' ? null : Number(v))

  function save() {
    setError(null)
    startTransition(async () => {
      try {
        for (const f of changed) await onSave(f.id, draft[f.id]!)
        showToast('Print settings saved')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save the settings')
      }
    })
  }

  const field = 'field w-full rounded-[var(--radius-inset)] font-semibold'

  return (
    <ul className="mb-4 flex flex-col gap-2">
      {files.map((f) => {
        const s = draft[f.id]!
        return (
          <li key={f.id} className="card-flat flex flex-col gap-3 px-4 py-3 text-sm">
            <a href={`/files/stl-files/${f.file_url}`} className="font-semibold text-brand-dark hover:underline">
              {f.filename}
            </a>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-xs font-bold text-muted">
                Minutes on the bed
                <input
                  type="number"
                  min={1}
                  max={1440}
                  className={field}
                  value={s.print_minutes ?? ''}
                  onChange={(e) => set(f.id, { print_minutes: num(e.target.value) })}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-bold text-muted">
                Filament (g)
                <input
                  type="number"
                  min={1}
                  max={5000}
                  className={field}
                  value={s.filament_grams ?? ''}
                  onChange={(e) => set(f.id, { filament_grams: num(e.target.value) })}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-bold text-muted">
                Material
                <select
                  className={field}
                  value={s.material ?? ''}
                  onChange={(e) => set(f.id, { material: (e.target.value || null) as StlMaterial | null })}
                >
                  <option value="">Not set</option>
                  {STL_MATERIALS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </label>
            </div>
          </li>
        )
      })}
      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}
      {changed.length > 0 && (
        <PanelActions>
          <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={save}>
            {pending ? 'Saving…' : 'Save print settings'}
          </button>
        </PanelActions>
      )}
    </ul>
  )
}
