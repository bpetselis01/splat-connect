import { describe, it, expect } from 'vitest'
import { intakeCredit, weighedInLine, recyclingPerDrop, RECYCLING_MACHINES, RECYCLING_FORMS } from '@splat-connect/types'

describe('intakeCredit', () => {
  it('waits for a weight', () => {
    expect(intakeCredit('', null)).toEqual({ ok: false, line: 'Weigh it to see the credit' })
    expect(intakeCredit('0', null)).toEqual({ ok: false, line: 'Weigh it to see the credit' })
  })

  it('prefills three quarters of the weight while the credit box is untouched', () => {
    expect(intakeCredit('2.6', null)).toEqual({ ok: true, weighed_grams: 2600, credit_grams: 1950, line: '1950 g credit' })
  })

  it('rounds the weight to the nearest 0.1 kg and takes the credit from the rounded weight', () => {
    expect(intakeCredit('2.14', null)).toEqual({ ok: true, weighed_grams: 2100, credit_grams: 1575, line: '1575 g credit' })
    expect(intakeCredit('2.15', null)).toMatchObject({ ok: true, weighed_grams: 2200, credit_grams: 1650 })
    expect(intakeCredit('1.96', null)).toMatchObject({ ok: true, weighed_grams: 2000 })
    expect(intakeCredit('1.94', null)).toEqual({
      ok: false,
      line: 'Under the 2 kg minimum — log it as a donation or hand it back',
    })
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

describe('recyclingPerDrop', () => {
  it('is the board’s range and turnaround', () => {
    expect(recyclingPerDrop({ recycling_min_kg: 2, recycling_max_kg: 8, recycling_turnaround: 'About 3 weeks' })).toBe('2–8 kg · About 3 weeks')
  })
  it('stands the platform floor in for an unset minimum', () => {
    expect(recyclingPerDrop({ recycling_max_kg: 5 })).toBe('2–5 kg')
  })
  it('reads "From" without a maximum', () => {
    expect(recyclingPerDrop({})).toBe('From 2 kg')
    expect(recyclingPerDrop({ recycling_min_kg: 3, recycling_turnaround: 'One school term' })).toBe('From 3 kg · One school term')
  })
})

describe('the board’s chip lists', () => {
  it('are the board’s five machines and five forms', () => {
    expect(RECYCLING_MACHINES).toEqual(['Shredder', 'Extruder', 'Filament dryer', 'Injection moulder', 'Sheet press'])
    expect(RECYCLING_FORMS).toEqual(['Failed prints', 'Offcuts', 'Sprues and rafts', 'Bottle caps', 'Clean packaging'])
  })
})
