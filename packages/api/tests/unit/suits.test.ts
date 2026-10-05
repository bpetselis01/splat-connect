import { describe, it, expect } from 'vitest'
import { CHILD_QUESTIONS, byRecommended, fitLine, matchesForChild, matchesSuits, readSuits, recommendScore, NO_SUITS_FILTER, suitsFilterCount } from '@splat-connect/types'

describe('readSuits', () => {
  it('keeps answers, drops duplicates, turns an empty list into null, and leaves out what the body leaves out', () => {
    expect(readSuits({ access: ['press', 'press', 'eyes'], helps_with: [], title: 'x' })).toEqual({ access: ['press', 'eyes'], helps_with: null })
  })
  it('refuses a value that is not an answer', () => {
    expect(readSuits({ play: ['lights'] })).toMatch(/^play must be a list of/)
    expect(readSuits({ device_types: 'switch' })).toMatch(/^device_types must be a list of/)
    expect(readSuits({ press_force: ['firm'] })).toMatch(/^press_force must be a list of/)
  })
  it('takes one_hand as true or false only', () => {
    expect(readSuits({ one_hand: true })).toEqual({ one_hand: true })
    expect(readSuits({ one_hand: 'yes' })).toMatch(/^one_hand must be true or false/)
  })
})

describe('matchesSuits', () => {
  const guide = { device_types: ['switch' as const], access: ['press' as const, 'head' as const], one_hand: true, press_force: ['very_light' as const, 'light' as const], play: ['light' as const, 'sound' as const] }
  it('no filter matches anything, tagged or not', () => {
    expect(matchesSuits({}, NO_SUITS_FILTER)).toBe(true)
  })
  it('any choice within a question, every question across', () => {
    expect(matchesSuits(guide, { ...NO_SUITS_FILTER, play: ['water', 'sound'] })).toBe(true)
    expect(matchesSuits(guide, { ...NO_SUITS_FILTER, play: ['sound'], access: ['eyes'] })).toBe(false)
    expect(matchesSuits(guide, { ...NO_SUITS_FILTER, press_force: ['light'], device_types: ['switch'] })).toBe(true)
  })
  it('One hand is enough keeps only guides that say so', () => {
    expect(matchesSuits(guide, { ...NO_SUITS_FILTER, one_hand: true })).toBe(true)
    expect(matchesSuits({ ...guide, one_hand: false }, { ...NO_SUITS_FILTER, one_hand: true })).toBe(false)
  })
  it('an item with no answer to a filtered question is left out', () => {
    expect(matchesSuits({ access: ['press'] }, { ...NO_SUITS_FILTER, helps_with: ['seeing'] })).toBe(false)
  })
  it('counts each choice, and One hand as one', () => {
    expect(suitsFilterCount({ ...NO_SUITS_FILTER, access: ['press'], play: ['light', 'calm'], one_hand: true })).toBe(4)
  })
})

describe('recommendScore and byRecommended', () => {
  const child = { name: 'Ollie', helps_with: ['seeing' as const, 'calm' as const], access: ['touch' as const], one_hand: true, press_force: 'light' as const, enjoys: ['light' as const] }
  it('counts shared answers across the four questions, one for one hand and one for a press it works with', () => {
    const g = { helps_with: ['seeing' as const], access: ['touch' as const, 'press' as const], one_hand: true, press_force: ['light' as const], play: ['light' as const, 'sound' as const] }
    expect(recommendScore(g, child)).toBe(5)
    expect(recommendScore({}, child)).toBe(0)
  })
  it('puts matches first, most shared first, then the rest newest first', () => {
    const items = [
      { id: 'old-none', created_at: '2026-01-01' },
      { id: 'new-none', created_at: '2026-09-01' },
      { id: 'one', created_at: '2026-02-01', play: ['light' as const] },
      { id: 'two', created_at: '2026-03-01', play: ['light' as const], access: ['touch' as const] },
    ]
    expect(byRecommended(items, child).map((i) => i.id)).toEqual(['two', 'one', 'new-none', 'old-none'])
    expect(byRecommended(items, null).map((i) => i.id)).toEqual(['new-none', 'two', 'one', 'old-none'])
  })
  it('fitLine names the first child a guide shares an answer with, or says nothing', () => {
    expect(fitLine({ play: ['light'] }, [child])).toBe('Suits Ollie')
    expect(fitLine({ play: ['water'] }, [child])).toBeNull()
  })
  it('matchesForChild counts guides and live toys that share an answer', () => {
    const m = matchesForChild(child, [{ id: 'g1', access: ['touch'] }, { id: 'g2' }], [
      { id: 't1', play: ['light'], status: 'published', paused_at: null },
      { id: 't2', play: ['light'], status: 'published', paused_at: '2026-01-01' },
    ])
    expect(m).toEqual({ guideIds: ['g1'], toyIds: ['t1'] })
  })
  it('the child questions are the item questions, field for field', () => {
    expect(CHILD_QUESTIONS.map((q) => [q.child, q.item])).toEqual([['helps_with', 'helps_with'], ['access', 'access'], ['press_force', 'press_force'], ['enjoys', 'play']])
  })
})
