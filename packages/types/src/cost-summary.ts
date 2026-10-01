/**
 * One thread's cost lines, as the caller sees them. The single place the
 * money sums live: the API's /mine and the mobile cost panel both call it.
 *
 * Only claimed lines count; a covered line is $0 to everyone. Directions are
 * never netted, and each direction settles on its own: the amount is what the
 * caller pays while that is open, or else what they are paid, and `owed_cents`
 * is only what they still owe.
 */
export interface CostLine {
  description: string
  amount_cents: number
  claiming: boolean
  payer_id: string
  payee_id: string
  settled_at: string | null
}

export interface CostSummary {
  /** What the caller pays, or else what they are paid. 0 means nothing claimed. */
  amount_cents: number
  you_pay: boolean
  /** Every claimed line in the direction shown is marked settled. */
  settled: boolean
  /** Claimed, unsettled lines the caller pays. */
  owed_cents: number
  /** Every claimed line the caller pays, settled or not. */
  you_pay_cents: number
  /** Every claimed line the caller is paid, settled or not. */
  you_get_cents: number
  what: string
}

export function costSummary(lines: CostLine[], userId: string): CostSummary {
  const claimed = lines.filter((l) => l.claiming)
  const sum = (ls: CostLine[]) => ls.reduce((n, l) => n + l.amount_cents, 0)
  const paying = claimed.filter((l) => l.payer_id === userId)
  const paid = claimed.filter((l) => l.payee_id === userId)
  const pay = sum(paying)
  const get = sum(paid)
  const open = (ls: CostLine[]) => ls.some((l) => !l.settled_at)
  // Each direction settles on its own: show the one still open, the caller's
  // own payments first. Once both are settled, what they paid.
  const showPay = pay > 0 && (open(paying) || !open(paid))
  return {
    amount_cents: showPay ? pay : get,
    you_pay: showPay,
    settled: !open(showPay ? paying : paid),
    owed_cents: sum(paying.filter((l) => !l.settled_at)),
    you_pay_cents: pay,
    you_get_cents: get,
    what: lines.map((l) => l.description).join(', '),
  }
}
