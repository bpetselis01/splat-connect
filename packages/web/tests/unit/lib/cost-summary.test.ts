import { describe, it, expect } from 'vitest'
import { costSummary } from '@splat-connect/types'

const line = (over: object = {}) => ({
  description: 'Postage', amount_cents: 1000, claiming: true, payer_id: 'me', payee_id: 'them', settled_at: null, ...over,
})

describe('costSummary', () => {
  it('is $0 to everyone when every line is covered', () => {
    expect(costSummary([line({ amount_cents: 0, claiming: false }), line({ amount_cents: 500, claiming: false })], 'me')).toMatchObject({
      amount_cents: 0, owed_cents: 0, settled: true,
    })
  })

  it('never nets the two directions: the payer side wins, owed counts only what the caller pays', () => {
    const s = costSummary([line(), line({ amount_cents: 400, payer_id: 'them', payee_id: 'me' })], 'me')
    expect(s).toMatchObject({ amount_cents: 1000, you_pay: true, owed_cents: 1000, settled: false })
  })

  it('shows what the caller is paid when they pay nothing, and owes nothing', () => {
    expect(costSummary([line({ payer_id: 'them', payee_id: 'me', amount_cents: 400 })], 'me')).toMatchObject({
      amount_cents: 400, you_pay: false, owed_cents: 0, settled: false,
    })
  })

  it('is settled once every claimed line is, and owes nothing then', () => {
    const at = '2026-10-01T00:00:00Z'
    const s = costSummary([line({ settled_at: at }), line({ amount_cents: 0, claiming: false })], 'me')
    expect(s).toMatchObject({ amount_cents: 1000, you_pay: true, owed_cents: 0, settled: true })
  })

  it('joins the descriptions in the words they were written in', () => {
    expect(costSummary([line(), line({ description: 'Box' })], 'me').what).toBe('Postage, Box')
  })
})
