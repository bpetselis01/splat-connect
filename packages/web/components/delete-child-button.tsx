'use client'
/**
 * Delete for a child profile, behind a typed confirmation.
 *
 * Deliberately unlike edit-items-section.tsx and admin/contributors, which both
 * delete on first click: a child profile is a page of hand-entered data with no
 * undo, and a parts row is not. The phrase echoes the label the page is already
 * showing, so the user has to read which child they are about to destroy — the
 * two-click arm/timeout this replaces could not tell them that.
 *
 * Dialog mechanics are contributor-terms-dialog.tsx's: a native <dialog> driven
 * by showModal()/close() from an effect, so the focus trap, Escape, and the
 * inert background come from the platform. As there, the native `close` event
 * is deliberately not wired to the cancel path — this component also closes
 * itself after a successful delete.
 */
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { browserApiClient } from '@/lib/browser-api-client'

export function DeleteChildButton({ id, label }: { id: string; label: string }) {
  const router = useRouter()
  const ref = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const phrase = `confirm_delete_${label.replace(/ /g, '_')}`

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  function cancel() {
    setOpen(false)
    setTyped('')
    setError(null)
  }

  async function confirmDelete() {
    setBusy(true)
    setError(null)
    try {
      await browserApiClient.delete(`/api/child-profiles/${id}`)
      router.push('/dashboard/child')
      router.refresh()
    } catch {
      // The dialog stays open with the phrase intact: a dropped request is not
      // a reason to make the user type it out again.
      setError('Could not delete this child profile. Please try again.')
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-danger btn-sm self-start"
      >
        Delete child profile
      </button>

      <dialog
        ref={ref}
        className="dialog-panel"
        onCancel={() => cancel()}
        onClick={(e) => {
          // A click that never reaches the inner div (stopped below) landed on
          // the dialog element itself, which for a modal <dialog> includes its
          // ::backdrop.
          if (e.target === ref.current) cancel()
        }}
      >
        <div onClick={(e) => e.stopPropagation()} className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-ink">Delete {label}?</h2>
          <p className="text-sm text-muted">
            This permanently deletes this child profile and everything recorded on it. It
            cannot be undone.
          </p>

          <div>
            <label htmlFor="confirm-delete-child" className="field-label">
              Type <code>{phrase}</code> to confirm
            </label>
            <input
              id="confirm-delete-child"
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="field"
            />
          </div>

          {error && (
            <p role="alert" className="alert alert-danger">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={cancel} className="btn btn-soft">
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={typed !== phrase || busy}
              className="btn btn-danger"
            >
              {busy ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </dialog>
    </>
  )
}
