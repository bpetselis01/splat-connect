'use client'
/**
 * The author's own safety notes (090), under the details form: a title and a
 * detail each, saved as one list. Anything that could hurt a child, stated
 * plainly — the board's lead for this section.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Note = { title: string; detail: string | null }

export function EditSafetyNotesSection({ notes: initial, onSave }: { notes: Note[]; onSave: (notes: Note[]) => Promise<void> }) {
  const [notes, setNotes] = useState<Note[]>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const edit = (i: number, patch: Partial<Note>) => setNotes((ns) => ns.map((n, k) => (k === i ? { ...n, ...patch } : n)))

  return (
    <section className="flex flex-col gap-3 px-5 pb-5" aria-labelledby="safety-notes-h">
      <h3 id="safety-notes-h" className="field-label">Safety notes</h3>
      <p className="m-0 text-xs leading-relaxed text-muted">Anything that could hurt a child, stated plainly.</p>
      {notes.map((n, i) => (
        <div key={i} className="flex flex-col gap-2">
          <input aria-label={`Safety note ${i + 1} title`} maxLength={80} value={n.title} onChange={(e) => edit(i, { title: e.target.value })} className="field" placeholder="Battery door must be screwed shut" />
          <textarea aria-label={`Safety note ${i + 1} detail`} maxLength={500} rows={2} value={n.detail ?? ''} onChange={(e) => edit(i, { detail: e.target.value || null })} className="field" />
          <button type="button" onClick={() => setNotes((ns) => ns.filter((_, k) => k !== i))} className="btn btn-quiet btn-sm self-start">Remove</button>
        </div>
      ))}
      {notes.length < 20 && (
        <button type="button" onClick={() => setNotes((ns) => [...ns, { title: '', detail: null }])} className="btn btn-quiet btn-sm self-start">
          Add a safety note
        </button>
      )}
      {error && <p role="alert" className="alert alert-danger">{error}</p>}
      <button
        type="button"
        disabled={saving}
        onClick={async () => {
          setSaving(true)
          setError(null)
          try {
            await onSave(notes.filter((n) => n.title.trim()).map((n) => ({ title: n.title.trim(), detail: n.detail?.trim() || null })))
            router.refresh()
          } catch {
            setError('Could not save the safety notes. Please try again.')
          } finally {
            setSaving(false)
          }
        }}
        className="btn btn-primary btn-sm self-start"
      >
        {saving ? 'Saving…' : 'Save safety notes'}
      </button>
    </section>
  )
}
