'use client'

/**
 * The questions a family answers when they request a print of this guide
 * (134). The contributor decides them, because each assistive device needs its
 * own measurements; none set means the request form says so.
 */
import { useState, useTransition } from 'react'
import { fieldKey, customizationFieldsProblem, MAX_CUSTOMIZATION_FIELDS } from '@splat-connect/types'
import type { CustomizationField } from '@splat-connect/types'
import { PanelActions } from '@/components/panel-actions'
import { useToast } from '@/components/toast'

type Row = { label: string; kind: 'choice' | 'number'; options: string; unit: string; min: string; max: string }

const blank = (): Row => ({ label: '', kind: 'choice', options: '', unit: 'mm', min: '', max: '' })

const toRow = (f: CustomizationField): Row =>
  f.kind === 'choice'
    ? { ...blank(), label: f.label, options: f.options.join('\n') }
    : { ...blank(), label: f.label, kind: 'number', unit: f.unit, min: String(f.min), max: String(f.max) }

function toField(r: Row): CustomizationField {
  const label = r.label.trim()
  const key = fieldKey(label)
  if (r.kind === 'choice') {
    return { key, label, kind: 'choice', options: r.options.split('\n').map((o) => o.trim()).filter(Boolean) }
  }
  return { key, label, kind: 'number', unit: r.unit.trim(), min: Number(r.min), max: Number(r.max) }
}

export function CustomizationFieldsForm({
  initial,
  onSave,
}: {
  initial: CustomizationField[]
  onSave: (fields: CustomizationField[]) => Promise<void>
}) {
  const showToast = useToast()
  const [rows, setRows] = useState<Row[]>(() => initial.map(toRow))
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const edit = (i: number, patch: Partial<Row>) => setRows((cur) => cur.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const field = 'field w-full rounded-[var(--radius-inset)] font-semibold'

  function save() {
    const fields = rows.map(toField)
    const bad = customizationFieldsProblem(fields)
    setError(bad)
    if (bad) return
    startTransition(async () => {
      try {
        await onSave(fields)
        showToast('Customization fields saved')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save the customization fields')
      }
    })
  }

  return (
    <section className="mt-6 flex flex-col gap-3" aria-label="Customization fields">
      <div>
        <h3 className="text-sm font-extrabold text-ink">Customization fields</h3>
        <p className="text-[13px] text-muted">
          What a family tells the printer when they request this guide’s parts, like “Tray thickness” with the options 10 mm and 15 mm.
          Leave empty if one size fits all.
        </p>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="card-flat flex flex-col gap-3 px-4 py-3 text-sm">
          <label className="flex flex-col gap-1 text-xs font-bold text-muted">
            Question
            <input className={field} maxLength={40} placeholder="e.g. Tray thickness" value={r.label} onChange={(e) => edit(i, { label: e.target.value })} />
          </label>
          <div role="radiogroup" aria-label="Answer type" className="flex gap-2">
            <button type="button" className="chip" aria-pressed={r.kind === 'choice'} onClick={() => edit(i, { kind: 'choice' })}>
              Choose one
            </button>
            <button type="button" className="chip" aria-pressed={r.kind === 'number'} onClick={() => edit(i, { kind: 'number' })}>
              A number
            </button>
          </div>
          {r.kind === 'choice' ? (
            <label className="flex flex-col gap-1 text-xs font-bold text-muted">
              Options, one per line
              <textarea className={field} rows={3} placeholder={'Small\nMedium\nLarge'} value={r.options} onChange={(e) => edit(i, { options: e.target.value })} />
            </label>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-xs font-bold text-muted">
                Unit
                <input className={field} maxLength={10} value={r.unit} onChange={(e) => edit(i, { unit: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-bold text-muted">
                Smallest
                <input type="number" className={field} value={r.min} onChange={(e) => edit(i, { min: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-bold text-muted">
                Largest
                <input type="number" className={field} value={r.max} onChange={(e) => edit(i, { max: e.target.value })} />
              </label>
            </div>
          )}
          <button type="button" className="btn btn-secondary btn-sm self-start" onClick={() => setRows((cur) => cur.filter((_, j) => j !== i))}>
            Remove this question
          </button>
        </div>
      ))}
      {rows.length < MAX_CUSTOMIZATION_FIELDS && (
        <button type="button" className="btn btn-secondary btn-sm self-start" onClick={() => setRows((cur) => [...cur, blank()])}>
          Add a question
        </button>
      )}
      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}
      <PanelActions>
        <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={save}>
          {pending ? 'Saving…' : 'Save customization fields'}
        </button>
      </PanelActions>
    </section>
  )
}
