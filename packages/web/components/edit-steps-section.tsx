'use client'
/**
 * The guide's numbered steps (080): add, reorder, edit, one optional photo
 * each, remove. The whole list saves at once — PUT /api/tutorials/:id/steps
 * replaces it in order — so there is one Save, like Parts and Tools.
 *
 * Not part of the submit gate: guides written before steps existed have none,
 * and the PDF stays the printable download either way.
 */
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ArrowDown, ArrowUp, Camera, Plus, Trash } from '@phosphor-icons/react'
import type { TutorialStep } from '@splat-connect/types'
import { PanelActions, useSaveOnLeave } from '@/components/panel-actions'
import { browserApiClient } from '@/lib/browser-api-client'
import { safePhotoSrc } from '@/lib/photo-src'
import { useToast } from '@/components/toast'

export type StepInput = { title: string | null; body: string; photo_url: string | null }
type Row = StepInput & { key: string }

const MAX_STEPS = 60

export function EditStepsSection({
  tutorialId,
  steps,
  onSave,
}: {
  tutorialId: string
  steps: TutorialStep[]
  onSave: (steps: StepInput[]) => Promise<void>
}) {
  const router = useRouter()
  const showToast = useToast()
  const [rows, setRows] = useState<Row[]>(() =>
    steps.map((s) => ({ key: s.id, title: s.title, body: s.body, photo_url: s.photo_url }))
  )
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})

  function change(next: Row[]) {
    setRows(next)
    setDirty(true)
  }
  const edit = (key: string, patch: Partial<StepInput>) =>
    change(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  function move(i: number, by: -1 | 1) {
    const next = [...rows]
    ;[next[i], next[i + by]] = [next[i + by], next[i]]
    change(next)
  }

  async function uploadPhoto(key: string, file: File) {
    setUploading(key)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('tutorialId', tutorialId)
      const { url } = await browserApiClient.postFormData<{ url: string }>('/api/upload/step-photo', fd)
      edit(key, { photo_url: url })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo upload failed')
    } finally {
      setUploading(null)
    }
  }

  async function save() {
    if (rows.some((r) => !r.body.trim())) {
      setError('Every step needs some instructions. Fill them in or remove the empty step.')
      return false
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(rows.map(({ title, body, photo_url }) => ({ title: title?.trim() || null, body, photo_url })))
      setDirty(false)
      showToast('Steps saved')
      router.refresh()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the steps')
      return false
    } finally {
      setSaving(false)
    }
  }

  useSaveOnLeave(dirty && !saving ? save : null)

  return (
    <div className="flex flex-col gap-4 px-5 pb-5">
      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}
      {rows.length === 0 && (
        <p className="m-0 text-sm leading-relaxed text-muted">
          One photo and one instruction per action. Optional — the PDF still carries the guide — but
          a parent can follow numbered steps on a phone without downloading anything.
        </p>
      )}
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {rows.map((r, i) => {
          const n = i + 1
          const src = r.photo_url ? safePhotoSrc(r.photo_url) : null
          return (
            <li key={r.key} className="flex flex-col gap-2.5 rounded-[var(--radius-inset)] border border-line bg-surface p-4">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-brand-tint font-display font-extrabold text-ink"
                >
                  {n}
                </span>
                <label htmlFor={`step-${r.key}-title`} className="sr-only">
                  Step {n} title
                </label>
                <input
                  id={`step-${r.key}-title`}
                  value={r.title ?? ''}
                  maxLength={120}
                  placeholder="Short title (optional)"
                  onChange={(e) => edit(r.key, { title: e.target.value })}
                  className="field flex-1"
                />
                <button type="button" aria-label={`Move step ${n} up`} disabled={i === 0} onClick={() => move(i, -1)} className="btn btn-quiet btn-sm">
                  <ArrowUp size={16} weight="bold" aria-hidden="true" />
                </button>
                <button type="button" aria-label={`Move step ${n} down`} disabled={i === rows.length - 1} onClick={() => move(i, 1)} className="btn btn-quiet btn-sm">
                  <ArrowDown size={16} weight="bold" aria-hidden="true" />
                </button>
                <button type="button" aria-label={`Remove step ${n}`} onClick={() => change(rows.filter((x) => x.key !== r.key))} className="btn btn-quiet btn-sm">
                  <Trash size={16} weight="bold" aria-hidden="true" />
                </button>
              </div>
              <label htmlFor={`step-${r.key}-body`} className="sr-only">
                Step {n} instructions
              </label>
              <textarea
                id={`step-${r.key}-body`}
                value={r.body}
                rows={3}
                maxLength={2000}
                placeholder="What to do in this step"
                onChange={(e) => edit(r.key, { body: e.target.value })}
                className="field"
              />
              <div className="flex flex-wrap items-center gap-3">
                {src && (
                  <span className="relative h-20 w-28 overflow-hidden rounded-[var(--radius-field)] bg-sunken">
                    <Image src={src} alt={`Step ${n} photo`} fill sizes="112px" className="object-cover" />
                  </span>
                )}
                <input
                  ref={(el) => {
                    fileInputs.current[r.key] = el
                  }}
                  type="file"
                  accept="image/*"
                  aria-label={`Photo for step ${n}`}
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void uploadPhoto(r.key, file)
                    e.target.value = ''
                  }}
                />
                <button type="button" disabled={uploading === r.key} onClick={() => fileInputs.current[r.key]?.click()} className="btn btn-quiet btn-sm">
                  <Camera size={16} weight="bold" aria-hidden="true" />
                  {uploading === r.key ? 'Uploading…' : r.photo_url ? 'Replace photo' : 'Add a photo'}
                </button>
                {r.photo_url && (
                  <button type="button" onClick={() => edit(r.key, { photo_url: null })} className="btn btn-quiet btn-sm">
                    Remove photo
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      {rows.length < MAX_STEPS && (
        <button
          type="button"
          onClick={() => change([...rows, { key: crypto.randomUUID(), title: null, body: '', photo_url: null }])}
          className="btn btn-quiet btn-sm self-start"
        >
          <Plus size={16} weight="bold" aria-hidden="true" />
          Add a step
        </button>
      )}
      <PanelActions>
        <button type="button" disabled={!dirty || saving || uploading !== null} onClick={save} className="btn btn-primary btn-sm">
          {saving ? 'Saving…' : 'Save steps'}
        </button>
      </PanelActions>
    </div>
  )
}
