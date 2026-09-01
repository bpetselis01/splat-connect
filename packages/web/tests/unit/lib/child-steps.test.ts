import { describe, it, expect } from 'vitest'
import { computeChildStepStatuses } from '@/lib/child-steps'
import type { ChildProfile } from '@splat-connect/types'

function child(over: Partial<ChildProfile> = {}): ChildProfile {
  return {
    id: 'c1',
    parent_id: 'u1',
    name: null,
    age: null,
    macs_level: null,
    macs_source: 'manual',
    hand_involvement: null,
    assist_hand: null,
    bfmf_score: null,
    bfmf_source: 'manual',
    challenges: [],
    challenge_other: null,
    grip_type: null,
    env_context: null,
    palm_width_mm: null,
    wrist_circ_mm: null,
    needs_arm_attachment: false,
    forearm_length_mm: null,
    hand_dominance: null,
    sensory_preferences: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  }
}

describe('computeChildStepStatuses', () => {
  it('marks every step neutral on a blank slate, before anything is saved', () => {
    expect(computeChildStepStatuses(null)).toEqual({
      survey: 'neutral',
      ability: 'neutral',
      'everyday-needs': 'neutral',
      customization: 'neutral',
    })
  })

  it('flags every step attention once a profile exists but nothing in it is filled', () => {
    const statuses = computeChildStepStatuses(child())
    expect(statuses).toEqual({
      survey: 'attention',
      ability: 'attention',
      'everyday-needs': 'attention',
      customization: 'attention',
    })
  })

  it('marks survey done only when both scores came from the estimator', () => {
    expect(
      computeChildStepStatuses(child({ macs_source: 'estimated', bfmf_source: 'estimated' })).survey
    ).toBe('done')
  })

  it('does not count a manually entered MACS/BFMF as the survey being done', () => {
    expect(
      computeChildStepStatuses(child({ macs_level: 'II', bfmf_score: '2' })).survey
    ).toBe('attention')
  })

  it('marks ability done once any of its fields has data', () => {
    expect(computeChildStepStatuses(child({ name: 'Emma' })).ability).toBe('done')
    expect(computeChildStepStatuses(child({ age: 7 })).ability).toBe('done')
  })

  it('marks everyday needs done once any of its fields has data', () => {
    expect(computeChildStepStatuses(child({ challenges: ['Grasping'] }))['everyday-needs']).toBe('done')
    expect(computeChildStepStatuses(child({ grip_type: 'Pincer' }))['everyday-needs']).toBe('done')
  })

  it('marks customization done once any of its fields has data', () => {
    expect(computeChildStepStatuses(child({ palm_width_mm: 40 })).customization).toBe('done')
    expect(computeChildStepStatuses(child({ needs_arm_attachment: true })).customization).toBe('done')
  })
})
