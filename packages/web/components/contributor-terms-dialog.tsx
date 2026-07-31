'use client'
/**
 * The signup-time terms dialog. A native <dialog> (showModal()) wrapping
 * TermsGate in mode="local" — the same pattern already used for the mobile
 * nav drawer in shell-frame.tsx: focus trap, Escape and an inert background
 * come from the platform, not hand-built code.
 *
 * Closing without accepting (Reject, Escape, or a backdrop click) only ever
 * calls onClose. Accepting only ever calls onAccepted. The two must never
 * both fire for the same interaction — see the click handler comment below
 * for why onClose is not also wired to the dialog's native `close` event.
 */
import { useEffect, useRef } from 'react'
import { TermsGate } from './terms-gate'
import { ContributorTermsContent } from './contributor-terms-content'

export function ContributorTermsDialog({
  open,
  onClose,
  onAccepted,
}: {
  open: boolean
  onClose: () => void
  onAccepted: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="terms-dialog"
      onCancel={() => onClose()}
      onClick={(e) => {
        // A click that never reaches the inner div (stopped below) landed on
        // the dialog element itself — for a modal <dialog> that includes
        // clicks on its ::backdrop, which the platform attributes to this
        // element. Deliberately not wired to the native `close` event: this
        // component also closes itself (via the effect above) after Accept,
        // and `close` fires for that too — wiring onClose there would call
        // both onClose and onAccepted for the same accept action.
        if (e.target === ref.current) onClose()
      }}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <TermsGate
          type="contributor_terms"
          requireCheckbox
          mode="local"
          content={<ContributorTermsContent />}
          onAccepted={onAccepted}
        />
        <button type="button" className="btn btn-soft btn-block mt-3" onClick={() => onClose()}>
          Reject
        </button>
      </div>
    </dialog>
  )
}
