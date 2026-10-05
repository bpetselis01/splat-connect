import { describe, it, expect } from 'vitest'
import { matchesSuits, readSuits, NO_SUITS_FILTER, suitsFilterCount } from '@splat-connect/types'

describe('readSuits', () => {
  it('keeps answers, drops duplicates, turns an empty list into null, and leaves out what the body leaves out', () => {
    expect(readSuits({ movement: ['press', 'press', 'lever'], hands: [], title: 'x' })).toEqual({ movement: ['press', 'lever'], hands: null })
  })
  it('refuses a value that is not an answer', () => {
    expect(readSuits({ play: ['lights'] })).toMatch(/^play must be a list of/)
    expect(readSuits({ hands: 'both' })).toMatch(/^hands must be a list of/)
  })
  it('checks fit ranges against the measurement bounds, smallest first', () => {
    expect(readSuits({ fit: { palm_width_mm: [40, 80], reach_cm: null } })).toEqual({ fit: { palm_width_mm: [40, 80] } })
    expect(readSuits({ fit: { palm_width_mm: [80, 40] } })).toMatch(/smallest first/)
    expect(readSuits({ fit: { palm_width_mm: [10, 40] } })).toMatch(/from 20 to 250/)
    expect(readSuits({ fit: { shoe_size: [1, 2] } })).toMatch(/^fit takes only/)
    expect(readSuits({ fit: {} })).toEqual({ fit: null })
  })
})

describe('matchesSuits', () => {
  const guide = { movement: ['press' as const], hands: ['one' as const, 'left' as const], play: ['light' as const, 'sound' as const], fit: { palm_width_mm: [40, 80] as [number, number] } }
  it('no filter matches anything, tagged or not', () => {
    expect(matchesSuits({}, NO_SUITS_FILTER)).toBe(true)
  })
  it('any choice within a question, every question across', () => {
    expect(matchesSuits(guide, { ...NO_SUITS_FILTER, play: ['water', 'sound'] })).toBe(true)
    expect(matchesSuits(guide, { ...NO_SUITS_FILTER, play: ['sound'], movement: ['lever'] })).toBe(false)
  })
  it('a measurement must sit inside the range', () => {
    expect(matchesSuits(guide, { ...NO_SUITS_FILTER, fit: { palm_width_mm: 62 } })).toBe(true)
    expect(matchesSuits(guide, { ...NO_SUITS_FILTER, fit: { palm_width_mm: 90 } })).toBe(false)
  })
  it('an item with no answer to a filtered question is left out', () => {
    expect(matchesSuits({ movement: ['press'] }, { ...NO_SUITS_FILTER, hands: ['both'] })).toBe(false)
    expect(matchesSuits({}, { ...NO_SUITS_FILTER, fit: { tray_mm: 15 } })).toBe(false)
  })
  it('counts each choice and each measurement', () => {
    expect(suitsFilterCount({ movement: ['press'], hands: [], play: ['light', 'calm'], fit: { reach_cm: 30 } })).toBe(4)
  })
})
