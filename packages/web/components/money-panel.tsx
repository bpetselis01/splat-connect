/**
 * "Money you have agreed to" — the bottom of the dashboard.
 *
 * It sits below the cards rather than above them because it is a summary of
 * commitments, not a destination: it tells you what is outstanding and then
 * gets out of the way. Putting a dollar figure at the top of a page about
 * adapting toys for disabled children says the wrong thing about what SPLAT is.
 *
 * Read-only by design. SPLAT never handles the money — the panel says so — and
 * settling is done from the exchange itself, where the other party and the
 * conversation are. A "mark settled" button here would be a control on a screen
 * with none of the context needed to press it honestly.
 */
import Link from 'next/link'
import { CurrencyDollar } from '@phosphor-icons/react/dist/ssr'
import { formatCents } from '@splat-connect/types'
import { Badge } from '@/components/badge'

export interface OutstandingLine {
  id: string
  transaction_id: string
  description: string
  amount_cents: number
  toy_transactions: { id: string; type: string; toys: { name: string } | null } | null
}

export function MoneyPanel({
  lines,
  totalCents,
  exchangeCount,
}: {
  lines: OutstandingLine[]
  totalCents: number
  exchangeCount: number
}) {
  // Nothing outstanding is the common case and deserves no panel at all — an
  // empty money summary is a worry with no object.
  if (lines.length === 0) return null

  return (
    <section
      aria-labelledby="money-heading"
      className="mt-10 grid gap-8 rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-e2 lg:grid-cols-[minmax(0,320px)_1fr]"
    >
      <div>
        <h2
          id="money-heading"
          className="text-xs font-extrabold uppercase tracking-widest text-muted"
        >
          Money you have agreed to
        </h2>
        {/* The board sets this one figure in the display face, not the numeral mono. */}
        <p className="font-display text-[40px] font-extrabold leading-none text-ink">
          {formatCents(totalCents)}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Still to settle across {exchangeCount} {exchangeCount === 1 ? 'exchange' : 'exchanges'}.
          SPLAT never handles the money — you pay each person directly, and either of you can mark
          it settled.
        </p>
      </div>

      <ul className="flex list-none flex-col gap-2.5">
        {lines.map((line) => (
          <li key={line.id}>
            <Link
              href={`/dashboard/exchanges/${line.transaction_id}`}
              className="flex items-center gap-3 rounded-[var(--radius-inset)] border border-line bg-canvas p-3 no-underline transition-colors hover:bg-sunken"
            >
              <span
                aria-hidden="true"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--radius-field)] bg-brand-tint text-ink"
              >
                <CurrencyDollar size={20} weight="duotone" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-ink">{line.description}</span>
                <span className="block truncate text-sm text-muted">
                  {line.toy_transactions?.toys?.name ?? 'This exchange'}
                </span>
              </span>
              <Badge status="pending" label="To settle" />
              <span className="font-mono font-bold tabular-nums text-ink">
                {formatCents(line.amount_cents)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
