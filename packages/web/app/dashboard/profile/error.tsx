'use client'
/**
 * Catches the child profile fetch failing (see page.tsx — the profile fetch no
 * longer swallows its error, on purpose). `reset()` is Next's real retry: it
 * re-runs the segment, so this is a real retry rather than copy promising one
 * (same bar as commit 6bb6a7b's library error state on mobile).
 */
export default function ProfileTabError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card flex max-w-xl flex-col gap-3 p-6">
      <p role="alert" className="alert alert-danger">
        Could not load your child profiles. Please try again.
      </p>
      <button type="button" onClick={reset} className="btn btn-accent self-start">
        Try again
      </button>
    </div>
  )
}
