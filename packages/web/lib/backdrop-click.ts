import type { MouseEvent } from 'react'

// A modal <dialog> reports clicks on its ::backdrop as clicks on itself — and
// so are clicks in its own padding (.dialog-panel has 1.75rem of it). Only a
// click that lands outside the dialog's box is the backdrop.
export function isBackdropClick(e: MouseEvent<HTMLDialogElement>): boolean {
  if (e.target !== e.currentTarget) return false
  const r = e.currentTarget.getBoundingClientRect()
  return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
}
