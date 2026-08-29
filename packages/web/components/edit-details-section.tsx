'use client'
import { PanelActions, useSaveOnLeave } from '@/components/panel-actions'
/**
 * The tutorial's core fields (title/description/difficulty), extracted from
 * a plain server-action form into a client component so a save conflict —
 * caught as a rejected onSave — can be shown instead of crashing to an error
 * boundary. Every call carries the updated_at loaded at page render, not a
 * freshly re-fetched one: that's the whole point of the check.
 */
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { KIND_LABEL, type Tutorial, type Difficulty, type TutorialKind } from '@splat-connect/types'
import { useToast } from '@/components/toast'

export function EditDetailsSection({
  tutorial,
  onSave,
}: {
  tutorial: Tutorial
  onSave: (patch: { title: string; description: string | null; difficulty: Difficulty; kind: TutorialKind; updated_at: string }) => Promise<void>
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
        kind: formData.get('kind') as TutorialKind,
        updated_at: tutorial.updated_at,
      })
      setDirty(false)
      showToast('Details saved')
      router.refresh()
      return true
    } catch {
      setConflict(true)
      return false
    } finally {
      setPending(false)
    }
  }

  /* Leaving the step saves it, so that walking on with Next costs nothing.
     The form is uncontrolled — the fields are the state — so the values come
     back out of the DOM the same way the submit handler gets them. Held to the
     same `dirty` guard as the Save button: an untouched form has nothing to
     write, and a conflicting write is the one thing this page has always been
     careful not to make by accident. */
  const formRef = useRef<HTMLFormElement>(null)
  useSaveOnLeave(
    dirty && !pending
      ? () => handleSubmit(new FormData(formRef.current!))
      : null
  )

  return (
    // Wrapped because handleSubmit reports whether it saved, which `action`
    // has no use for. Safe to wrap here where the same thing on the page's
    // server actions would not be: this is a client function already.
    <form
      ref={formRef}
      action={(formData) => void handleSubmit(formData)}
      onChange={() => setDirty(true)}
      className="flex flex-col gap-3 px-5 pb-5"
    >
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
      <div>
        {/* Editable, not just shown: picking the wrong card on /upload should
            cost a select change, not a new tutorial. Changing it redraws the
            pill row — the STL step appears or goes — on the refresh that
            follows the save. */}
        <label htmlFor="edit-kind" className="field-label">Kind</label>
        <select id="edit-kind" key={tutorial.kind} name="kind" defaultValue={tutorial.kind} className="field">
          {(Object.keys(KIND_LABEL) as TutorialKind[]).map((k) => (
            <option key={k} value={k}>{KIND_LABEL[k]}</option>
          ))}
        </select>
      </div>
      <PanelActions>
        <button type="submit" disabled={!dirty || pending} className="btn btn-primary btn-sm">
          {pending ? 'Saving…' : 'Save details'}
        </button>
      </PanelActions>
    </form>
  )
}
