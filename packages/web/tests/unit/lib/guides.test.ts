import { describe, it, expect } from 'vitest'
import { checkedOn, partsTotalCents } from '@splat-connect/types'

describe('partsTotalCents', () => {
  it('sums the required parts once every one has a price', () => {
    expect(partsTotalCents([{ is_optional: false, price_cents: 600 }, { is_optional: false, price_cents: 450 }, { is_optional: true, price_cents: null }])).toBe(1050)
  })
  it('shows no total while a required part is unpriced', () => {
    expect(partsTotalCents([{ is_optional: false, price_cents: 600 }, { is_optional: false, price_cents: null }])).toBeNull()
    expect(partsTotalCents([{ is_optional: false }])).toBeNull()
  })
  it('shows no total for a list with nothing required', () => {
    expect(partsTotalCents([])).toBeNull()
    expect(partsTotalCents([{ is_optional: true, price_cents: 100 }])).toBeNull()
  })
  it('counts a free part as priced', () => {
    expect(partsTotalCents([{ is_optional: false, price_cents: 0 }])).toBe(0)
  })
})

describe('checkedOn', () => {
  it('writes the date the board way, without shifting a day', () => {
    expect(checkedOn('2026-08-02')).toBe('2 Aug 2026')
  })
})
