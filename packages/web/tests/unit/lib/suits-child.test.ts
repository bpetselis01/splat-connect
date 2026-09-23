import { describe, it, expect } from 'vitest'
import { suitsChild, switchSummary } from '@splat-connect/types'

describe('suitsChild', () => {
  const light = { switch_target: 'large', switch_force: 'light', switch_hold: 'moment' } as const
  it('suits a child who can do at least what every tag asks', () => {
    expect(suitsChild(light, { press_force: 'moderate', hold: 'second', aim: 'large' })).toBe(true)
  })
  it('does not suit a child who cannot press that hard, hold that long, or aim that small', () => {
    expect(suitsChild(light, { press_force: 'very_light', hold: 'second', aim: 'large' })).toBe(false)
    expect(suitsChild({ switch_hold: 'as_long' }, { press_force: null, hold: 'moment', aim: null })).toBe(false)
    expect(suitsChild({ switch_target: 'small' }, { press_force: null, hold: null, aim: 'large' })).toBe(false)
    expect(suitsChild({ switch_target: 'large' }, { press_force: null, hold: null, aim: 'not_reliably' })).toBe(false)
  })
  it('says nothing when there is nothing to compare', () => {
    expect(suitsChild({}, { press_force: 'light', hold: 'moment', aim: 'large' })).toBeNull()
    expect(suitsChild(light, { press_force: null, hold: null, aim: null })).toBeNull()
  })
  it('reads the tags back in the board’s words', () => {
    expect(switchSummary(light)).toBe('big button, light press, short hold')
    expect(switchSummary({})).toBeNull()
  })
})
