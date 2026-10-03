// The money an exchange or build thread records. SPLAT never moves it, but two
// families read these numbers and agree on them, so cents stay integers and a
// direction is never netted against the other.
import { costSummary, dollarsToCents, formatCents } from '@splat-connect/types'

describe('dollarsToCents', () => {
  it.each([
    ['6.50', 650],
    ['6.5', 650],
    ['6', 600],
    ['0', 0],
    ['0.00', 0],
    ['0.01', 1],
    ['$6.50', 650],
    ['$ 6.50', 650],
    ['  12.10  ', 1210],
    ['12.10', 1210],
    ['1.15', 115],
    ['19.99', 1999],
    ['1000000', 100_000_000],
    ['999999999.99', 99_999_999_999],
  ])('reads %j as %i cents', (typed, cents) => {
    expect(dollarsToCents(typed)).toBe(cents)
  })

  it.each([
    '',
    '   ',
    '-5',
    '-0.01',
    '.5',
    '6.',
    '6.505',
    '6,50',
    '1,000',
    '1 000',
    '6.5.0',
    '1e2',
    'six',
    '$',
    '$$5',
    '5$',
    '€5',
    '٥',
    '1000000000',
    '+5',
    '5\n5',
    '<b>5</b>',
    '5 dollars',
  ])('refuses %j', (typed) => {
    expect(dollarsToCents(typed)).toBeNull()
  })

  it('never drifts by a cent on any two-decimal amount up to $100', () => {
    for (let c = 0; c <= 10_000; c++) {
      expect(dollarsToCents((c / 100).toFixed(2))).toBe(c)
    }
  })
})

describe('formatCents', () => {
  it.each([
    [0, '$0.00'],
    [1, '$0.01'],
    [650, '$6.50'],
    [100_000_000, '$1,000,000.00'],
    [-250, '-$2.50'],
  ])('shows %i cents as %s', (cents, text) => {
    expect(formatCents(cents)).toBe(text)
  })
})

describe('costSummary', () => {
  const line = (over: object = {}) => ({
    description: 'Parts', amount_cents: 650, claiming: true, payer_id: 'fam', payee_id: 'maker', settled_at: null, ...over,
  })

  it('is all zero for no lines', () => {
    expect(costSummary([], 'fam')).toMatchObject({ amount_cents: 0, you_pay_cents: 0, you_get_cents: 0, owed_cents: 0, you_pay: false })
  })

  it('counts a covered line as nothing to either side', () => {
    const s = costSummary([line({ claiming: false, amount_cents: 400 })], 'fam')
    expect(s.you_pay_cents).toBe(0)
    expect(costSummary([line({ claiming: false, amount_cents: 400 })], 'maker').you_get_cents).toBe(0)
  })

  it('sums claimed lines exactly in cents', () => {
    const lines = [line({ amount_cents: 1 }), line({ amount_cents: 10 }), line({ amount_cents: 1999 })]
    expect(costSummary(lines, 'fam').you_pay_cents).toBe(2010)
    expect(costSummary(lines, 'maker').you_get_cents).toBe(2010)
  })

  it('does not net what the maker owes the family against what the family owes the maker', () => {
    const lines = [line({ amount_cents: 650 }), line({ payer_id: 'maker', payee_id: 'fam', amount_cents: 650 })]
    const s = costSummary(lines, 'fam')
    expect(s.you_pay_cents).toBe(650)
    expect(s.you_get_cents).toBe(650)
    expect(s.owed_cents).toBe(650)
  })

  it('owes nothing once every line the viewer pays is settled, and still reports what they paid', () => {
    const s = costSummary([line({ settled_at: '2026-10-01T00:00:00Z' })], 'fam')
    expect(s.owed_cents).toBe(0)
    expect(s.you_pay_cents).toBe(650)
    expect(s.settled).toBe(true)
  })

  it('owes only the unsettled part of a partly settled set', () => {
    const s = costSummary([line({ amount_cents: 300, settled_at: '2026-10-01T00:00:00Z' }), line({ amount_cents: 200 })], 'fam')
    expect(s.owed_cents).toBe(200)
    expect(s.you_pay_cents).toBe(500)
    expect(s.settled).toBe(false)
  })

  it('is nothing for a stranger to the thread', () => {
    expect(costSummary([line()], 'stranger')).toMatchObject({ you_pay_cents: 0, you_get_cents: 0, owed_cents: 0 })
  })

  it('keeps a zero-cent covered line out of the totals and its words in the description', () => {
    const s = costSummary([line({ claiming: false, amount_cents: 0, description: 'Postage — "free" & <ok>' })], 'fam')
    expect(s.you_pay_cents).toBe(0)
    expect(s.what).toBe('Postage — "free" & <ok>')
  })
})
