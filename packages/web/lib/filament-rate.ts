import { formatCents } from '@splat-connect/types'

/**
 * A printer's standard rate as the card and the form draw it (070).
 *
 * Null is the toggle's off state — the printer never set one — and reads as
 * free rather than as a missing number, because "parts only" is the answer a
 * family is looking for. Zero is a set rate of nothing and formats like one.
 */
export function filamentRate(cents: number | null): string {
  return cents === null ? 'Free · parts only' : `${formatCents(cents)} / g`
}
