/**
 * One thread's cost lines, as the caller sees them. The single place the
 * money sums live: the API's /mine and the mobile cost panel both call it.
 *
 * Only claimed lines count; a covered line is $0 to everyone. Directions are
 * never netted: the amount is what the caller pays, or else what they are paid,
 * and `owed_cents` is only what they still owe.
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
  /** Every claimed line marked settled. */
  settled: boolean
  /** Claimed, unsettled lines the caller pays. */
  owed_cents: number
  what: string
}

export function costSummary(lines: CostLine[], userId: string): CostSummary {
  const claimed = lines.filter((l) => l.claiming)
  const sum = (ls: CostLine[]) => ls.reduce((n, l) => n + l.amount_cents, 0)
  const pay = sum(claimed.filter((l) => l.payer_id === userId))
  const get = sum(claimed.filter((l) => l.payee_id === userId))
  return {
    amount_cents: pay > 0 ? pay : get,
    you_pay: pay > 0,
    settled: claimed.every((l) => l.settled_at !== null),
    owed_cents: sum(claimed.filter((l) => l.payer_id === userId && !l.settled_at)),
    what: lines.map((l) => l.description).join(', '),
  }
}
