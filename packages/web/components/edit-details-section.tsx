'use client'
/**
 * The tutorial's core fields (title/description/difficulty), extracted from
 * a plain server-action form into a client component so a save conflict —
 * caught as a rejected onSave — can be shown instead of crashing to an error
 * boundary. Every call carries the updated_at loaded at page render, not a
 * freshly re-fetched one: that's the whole point of the check.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Tutorial, Difficulty } from '@splat-connect/types'
import { useToast } from '@/components/toast'

export function EditDetailsSection({
  tutorial,
  onSave,
}: {
  tutorial: Tutorial
  onSave: (patch: { title: string; description: string | null; difficulty: Difficulty; updated_at: string }) => Promise<void>
}) {
  const router = useRouter()
  const showToast = useToast()
  const [pending, setPending] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [dirty, setDirty] = useState(false)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setConflict(false)
    try {
      await onSave({
        title: formData.get('title') as string,
        description: (formData.get('description') as string) || null,
        difficulty: formData.get('difficulty') as Difficulty,
        updated_at: tutorial.updated_at,
      })
      setDirty(false)
      showToast('Details saved')
      router.refresh()
    } catch {
      setConflict(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <form action={handleSubmit} onChange={() => setDirty(true)} className="flex flex-col gap-3 px-5 pb-5">
      {conflict && (
        <p role="alert" className="alert alert-danger">
          This was updated while you were editing — reload to see the latest version before
          saving your changes.
        </p>
      )}
      <div>
        <label htmlFor="edit-title" className="field-label">Title</label>
        <input id="edit-title" name="title" defaultValue={tutorial.title} required className="field" />
      </div>
      <div>
        <label htmlFor="edit-description" className="field-label">Description</label>
        <textarea id="edit-description" name="description" defaultValue={tutorial.description ?? ''} rows={4} className="field" />
      </div>
      <div>
        <label htmlFor="edit-difficulty" className="field-label">Difficulty</label>
        <select id="edit-difficulty" key={tutorial.difficulty} name="difficulty" defaultValue={tutorial.difficulty} className="field">
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </div>
      <div className="flex justify-end">
        <button type="submit" disabled={!dirty || pending} className="btn btn-primary btn-sm self-end">
          {pending ? 'Saving…' : 'Save details'}
        </button>
      </div>
    </form>
  )
}
