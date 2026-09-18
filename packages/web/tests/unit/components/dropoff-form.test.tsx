import { describe, it, expect } from 'vitest'
import { kgToGrams } from '@/components/dropoff-form'
import { estimatedCreditGrams, MIN_DROPOFF_GRAMS, RECYCLING_DECLARATION } from '@splat-connect/types'

/**
 * The two numbers on this form and the list that gates it.
 *
 * Weight is parsed rather than trusted to `type="number"`: the field is
 * inputMode="decimal" so a phone offers a numeric keypad without the spinner,
 * which means the value arrives as whatever was typed.
 */
describe('kgToGrams', () => {
  it('reads whole and fractional kilos as whole grams', () => {
    expect(kgToGrams('2')).toBe(2000)
    expect(kgToGrams('2.5')).toBe(2500)
    // Padded, not parsed as a float: 2.5 must be 2500 g and not 2.5 g, and
    // "2.05" must be 2050 rather than 2500.
    expect(kgToGrams('2.05')).toBe(2050)
    expect(kgToGrams('  3.125 ')).toBe(3125)
  })

  it('refuses anything that is not a weight', () => {
    for (const bad of ['', 'two', '2kg', '-2', '2.', '1.2345', '12345']) {
      expect(kgToGrams(bad), bad).toBeNull()
    }
  })
})

describe('the credit estimate', () => {
  // Chain: about three quarters of what comes in survives shredding and
  //        extrusion. The number is an ESTIMATE everywhere it renders — the
  //        credit follows the weight the organisation records at the door
  it('is three quarters, rounded down', () => {
    expect(estimatedCreditGrams(2000)).toBe(1500)
    expect(estimatedCreditGrams(3333)).toBe(2499)
  })

  it('never rounds up into a promise', () => {
    for (const g of [1, 999, 2001, 7777]) {
      expect(estimatedCreditGrams(g)).toBeLessThanOrEqual(g * 0.75)
    }
  })
})

describe('the declaration', () => {
  // Chain: the public page promises "Seven lines, all required", and the form
  //        disables its confirm until every one is ticked. A line added to the
  //        list without that copy changing makes the page wrong
  it('is seven lines', () => {
    expect(RECYCLING_DECLARATION).toHaveLength(7)
  })

  it('sets the minimum at two kilos', () => {
    expect(MIN_DROPOFF_GRAMS).toBe(2000)
  })
})
