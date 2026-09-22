import { describe, it, expect } from 'vitest'
import { filamentRate } from '@/lib/filament-rate'

describe('filamentRate', () => {
  it('reads null as the free, parts-only state rather than a missing number', () => {
    expect(filamentRate(null)).toBe('Free · parts only')
  })

  it('formats integer cents per gram as dollars', () => {
    expect(filamentRate(12)).toBe('$0.12 / g')
    expect(filamentRate(5)).toBe('$0.05 / g')
    expect(filamentRate(100)).toBe('$1.00 / g')
  })

  it('keeps a set rate of zero distinct from no rate', () => {
    expect(filamentRate(0)).toBe('$0.00 / g')
  })
})
