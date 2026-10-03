/**
 * A section or page that waits on something only the owner can supply (legal
 * text, names, a maps provider, images). One treatment everywhere, so a
 * half-built feature never shows through: the words say what is missing.
 * Items live in packages/types/src/pending.ts.
 */
import { Hourglass } from '@phosphor-icons/react/dist/ssr'

export function ToBeCompleted({
  subject,
  children,
  compact,
}: {
  /** What is missing, when the surrounding page does not already say. */
  subject?: string
  /** The one line: what will appear here. */
  children: React.ReactNode
  /** Sits inside a page as a card instead of standing in for it. */
  compact?: boolean
}) {
  return (
    <div
      className={`mx-auto flex flex-col items-center rounded-card border border-line bg-sunken text-center ${
        compact ? 'my-4 gap-1.5 px-5 py-5' : 'my-14 max-w-[640px] gap-2 px-6 py-12'
      }`}
    >
      <Hourglass size={compact ? 24 : 40} weight="duotone" className="text-muted" aria-hidden="true" />
      <p className="m-0 text-[13px] font-extrabold uppercase tracking-[0.1em] text-muted">To be completed</p>
      {subject && <h2 className="m-0 font-display text-2xl font-extrabold text-ink">{subject}</h2>}
      <p className="m-0 max-w-[48ch] text-[15px] leading-[1.55] text-muted">{children}</p>
    </div>
  )
}
