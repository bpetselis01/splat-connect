'use client'
/**
 * A button that opens an honest dead end.
 *
 * The challenge board is a visual stub: the posting and claiming flows have no
 * data model behind them yet. A button that silently does nothing is worse than
 * one that says so, and disabling them would hide what the page is for.
 *
 * Native <dialog> + showModal(), the pattern already used by
 * contributor-terms-dialog.tsx and shell-frame.tsx's nav drawer: focus trap,
 * Escape and an inert background come from the platform. The transition lives in
 * globals.css's .dialog-panel rules, including the reduced-motion variant.
 */
import { useRef } from 'react'
import Link from 'next/link'

export function NotLiveDialog({
  label,
  className,
  heading,
  body,
}: {
  label: string
  className?: string
  heading: string
  body: string
}) {
  const ref = useRef<HTMLDialogElement>(null)

  return (
    <>
      <button type="button" className={className} onClick={() => ref.current?.showModal()}>
        {label}
      </button>
      <dialog
        ref={ref}
        className="dialog-panel"
        onClick={(e) => {
          // A click that never reaches the inner div landed on the dialog
          // itself, which for a modal <dialog> includes its ::backdrop.
          if (e.target === ref.current) ref.current?.close()
        }}
      >
        <div onClick={(e) => e.stopPropagation()}>
          <h2 className="text-lg font-bold text-ink">{heading}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/library" className="btn btn-accent">
              Browse tutorials
            </Link>
            <button
              type="button"
              className="btn btn-soft"
              onClick={() => ref.current?.close()}
            >
              Close
            </button>
          </div>
        </div>
      </dialog>
    </>
  )
}
