import { describe, it, expect } from 'vitest'
import { getMissingToyFields, computeToyStepStatuses } from '@/lib/toy-steps'
import type { Toy } from '@splat-connect/types'

function toy(overrides: Partial<Toy> = {}): Toy {
  return {
    id: 't1',
    owner_id: 'u1',
    name: 'Fire truck',
    description: null,
    condition: 8,
    switch_adapted: false,
    cover_photo_url: 'https://example.com/cover.jpg',
    switch_photo_urls: [],
    status: 'draft',
    created_at: '',
    updated_at: '',
    offer_type: null,
    archived_at: null,
    ...overrides,
  }
}

describe('getMissingToyFields', () => {
  it('flags a missing cover photo', () => {
    expect(getMissingToyFields(toy({ cover_photo_url: null }))).toEqual(['Cover photo'])
  })

  it('does not require switch photos when not switch-adapted', () => {
    expect(getMissingToyFields(toy({ switch_adapted: false, switch_photo_urls: [] }))).toEqual([])
  })

  it('requires at least one switch photo when switch-adapted', () => {
    expect(getMissingToyFields(toy({ switch_adapted: true, switch_photo_urls: [] }))).toEqual(['Switch photo'])
  })

  it('is satisfied once a switch photo exists', () => {
    expect(
      getMissingToyFields(toy({ switch_adapted: true, switch_photo_urls: ['https://x/switch-1.jpg'] }))
    ).toEqual([])
  })
})

describe('computeToyStepStatuses', () => {
  it('marks details always done, since name/condition are required at creation', () => {
    expect(computeToyStepStatuses(toy()).details).toBe('done')
  })

  it('flags photos as attention when the cover photo is missing', () => {
    expect(computeToyStepStatuses(toy({ cover_photo_url: null })).photos).toBe('attention')
  })

  it('marks photos done once every publish precondition is met', () => {
    expect(computeToyStepStatuses(toy()).photos).toBe('done')
  })

  it('review is neutral while draft and done once published', () => {
    expect(computeToyStepStatuses(toy({ status: 'draft' })).review).toBe('neutral')
    expect(computeToyStepStatuses(toy({ status: 'published' })).review).toBe('done')
  })
})
