import { describe, it, expect } from 'vitest'
import { intakeCredit, weighedInLine } from '@splat-connect/types'

describe('intakeCredit', () => {
  it('waits for a weight', () => {
    expect(intakeCredit('', null)).toEqual({ ok: false, line: 'Weigh it to see the credit' })
    expect(intakeCredit('0', null)).toEqual({ ok: false, line: 'Weigh it to see the credit' })
  })

  it('prefills three quarters of the weight while the credit box is untouched', () => {
    expect(intakeCredit('2.6', null)).toEqual({ ok: true, weighed_grams: 2600, credit_grams: 1950, line: '1950 g credit' })
  })

  it('keeps what the leader typed when the weight changes', () => {
    expect(intakeCredit('3', '2000')).toEqual({ ok: true, weighed_grams: 3000, credit_grams: 2000, line: '2000 g credit' })
    expect(intakeCredit('4', '2000')).toMatchObject({ ok: true, credit_grams: 2000 })
  })

  it('refuses under the two-kilo floor in the board’s words', () => {
    expect(intakeCredit('1.5', null)).toEqual({
      ok: false,
      line: 'Under the 2 kg minimum — log it as a donation or hand it back',
    })
  })

  it('never sends a cleared or fractional credit as a number', () => {
    expect(intakeCredit('3', '')).toEqual({ ok: false, line: 'Enter the credit in whole grams.' })
    expect(intakeCredit('3', '12.5')).toEqual({ ok: false, line: 'Enter the credit in whole grams.' })
  })

  it('holds a credit above the weight', () => {
    expect(intakeCredit('2', '2500')).toEqual({ ok: false, line: 'Credit cannot be more than what was weighed.' })
    expect(intakeCredit('2', '2000')).toMatchObject({ ok: true, credit_grams: 2000 })
    expect(intakeCredit('2', '0')).toMatchObject({ ok: true, credit_grams: 0 })
  })
})

describe('weighedInLine', () => {
  it('is the board’s toast', () => {
    expect(weighedInLine(2600, 1950, 'Tom Beattie')).toBe('Weighed at 2.6 kg — 1950 g credit issued to Tom Beattie')
  })
})
