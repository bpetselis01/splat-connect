import { describe, it, expect } from 'vitest'
import { printCostCents, costRange } from '@splat-connect/types'

describe('printCostCents', () => {
  it('sums grams × quantity × rate', () => {
    expect(printCostCents([{ filament_grams: 10, quantity: 2 }, { filament_grams: 5 }], 12)).toBe(300)
  })
  it('is null with no rate — null is free, parts only (070)', () => {
    expect(printCostCents([{ filament_grams: 10 }], null)).toBeNull()
  })
  it('is null when any part lacks grams, rather than a confident undercount', () => {
    expect(printCostCents([{ filament_grams: 10 }, { filament_grams: null }], 12)).toBeNull()
  })
  it('is null with nothing ticked', () => {
    expect(printCostCents([], 12)).toBeNull()
  })
})

describe('costRange', () => {
  it('spans the printers that have an estimate', () => {
    expect(costRange([300, null, 120])).toEqual([120, 300])
  })
  it('is null when none has one', () => {
    expect(costRange([null, null])).toBeNull()
  })
})
