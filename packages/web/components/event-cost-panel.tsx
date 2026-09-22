/**
 * What an event costs a family to come. 069.
 *
 * Drawn on the public detail page and again on the register form, above the
 * acknowledgement, so nobody confirms a spot without having seen the figure.
 * A free event (null or 0) draws nothing at all: "Free to attend" is already
 * on the where line, and a panel announcing $0.00 would make people look for
 * the catch.
 *
 * The decision — the amount — stays visible; the evidence — the host's
 * breakdown — goes behind the caret, per the Disclosure rule. No settlement
 * state and no receipt, because SPLAT never handles the money: this is a fact
 * about the event, not a ledger.
 */
import { formatCents } from '@splat-connect/types'
import { Disclosure } from '@/components/disclosure'

export function EventCostPanel({
  orgName,
  costCents,
  costNote,
  className = '',
}: {
  orgName: string
  costCents: number | null
  costNote: string | null
  className?: string
}) {
  if (!costCents || costCents <= 0) return null
  return (
    <section
      aria-label="What it costs you to come"
      className={`flex flex-col gap-3 rounded-[20px] border border-line bg-[var(--surface)] px-5 py-[18px] ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3.5">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[.1em] text-muted">
            What it costs you to come
          </p>
          <p className="mt-[5px] max-w-[56ch] text-[13.5px] leading-[1.5] text-muted">
            {orgName} runs the day free. These are the materials they ask a family to cover, in
            their own words.
          </p>
        </div>
        <span className="shrink-0 rounded-[14px] bg-[var(--tamber)] px-3.5 py-2 text-right text-[var(--tink)]">
          <span className="block text-[10.5px] font-extrabold uppercase tracking-[.08em]">You pay back</span>
          <h3 className="font-display text-[22px] font-extrabold leading-[1.1] tabular-nums">
            {formatCents(costCents)}
          </h3>
        </span>
      </div>
      {costNote && (
        <div className="-mx-5 -mb-[18px]">
          <Disclosure summary="Breakdown" defaultOpen>
            {/* The host's words, drawn as the board's note card: quoted, with
                a byline, so it reads as theirs and not SPLAT's. */}
            <div className="rounded-[14px] border border-line bg-[var(--surface2)] px-4 py-3">
              <p className="whitespace-pre-line text-[15px] font-bold leading-[1.5] text-ink">{costNote}</p>
              <p className="mt-1.5 text-[13px] font-bold text-muted">{orgName}’s note</p>
            </div>
          </Disclosure>
        </div>
      )}
    </section>
  )
}
