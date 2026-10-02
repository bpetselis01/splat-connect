import { describe, it, expect } from 'vitest'
import { matchesForChild, childNeedsLine } from '@splat-connect/types'

const guide = (id: string, over: object = {}) => ({ id, switch_target: null, switch_force: null, switch_hold: null, ...over })
const toy = (id: string, over: object = {}) => ({ id, switch_adapted: true, status: 'published' as const, paused_at: null, ...over })

describe('matchesForChild (wizard-mascot-done)', () => {
  const child = { press_force: 'light' as const, aim: 'large' as const, hold: 'second' as const }

  it("matches a guide whose switch is within the child's answers, and no other", () => {
    const { guideIds } = matchesForChild(
      child,
      [
        guide('fits', { switch_force: 'very_light', switch_target: 'large', switch_hold: 'moment' }),
        guide('too-firm', { switch_force: 'full' }),
        guide('too-small', { switch_target: 'small' }),
        guide('untagged'),
      ],
      []
    )
    // An untagged guide is "nothing to compare" (suitsChild null), never a match.
    expect(guideIds).toEqual(['fits'])
  })

  it('counts switch-adapted, published, not-paused toys, whatever the child', () => {
    const { toyIds } = matchesForChild(
      { press_force: null, aim: null, hold: null },
      [],
      [toy('yes'), toy('plain', { switch_adapted: false }), toy('draft', { status: 'draft' }), toy('paused', { paused_at: '2026-09-01' })]
    )
    expect(toyIds).toEqual(['yes'])
  })
})

describe('childNeedsLine', () => {
  it("says what the child's switch needs in the board's shape", () => {
    expect(childNeedsLine({ press_force: 'light', aim: 'large' })).toBe('a light press with a big button')
    expect(childNeedsLine({ press_force: 'full', aim: 'small' })).toBe('a firm press with a small target')
    expect(childNeedsLine({ press_force: null, aim: 'large' })).toBe('a big button')
    expect(childNeedsLine({ press_force: 'moderate', aim: 'not_reliably' })).toBe('a moderate press')
  })

  it('is null with nothing to say — the screen then says "your child"', () => {
    expect(childNeedsLine({ press_force: null, aim: null })).toBeNull()
  })
})
