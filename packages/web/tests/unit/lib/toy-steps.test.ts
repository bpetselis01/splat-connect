import { describe, it, expect } from 'vitest'
import { getMissingToyFields, computeToyStepStatuses } from '@/lib/toy-steps'
import type { Toy } from '@splat-connect/types'

function toy(overrides: Partial<Toy> = {}): Toy {
  return {
    id: 't1',
    owner_id: 'u1',
    owner_org_id: null,
    quantity: 1,
    name: 'Fire truck',
    description: null,
    condition: 8,
    switch_adapted: false,
    cover_photo_url: 'https://example.com/cover.jpg',
    switch_photo_urls: [],
    status: 'draft',
    created_at: '',
    updated_at: '',
    offer_type: 'donation',
    archived_at: null,
    ...overrides,
  }
}

// Each gap carries the step that closes it, so the publish bar can name what
// is missing and hand over the fix in one gesture. Offer type is chosen in the
// Review panel, which is why it points there rather than at Photos.
describe('getMissingToyFields', () => {
  it('flags a missing cover photo, pointing at Photos', () => {
    expect(getMissingToyFields(toy({ cover_photo_url: null }))).toEqual([
      { step: 'photos', label: 'A cover photo' },
    ])
  })

  it('does not require switch photos when not switch-adapted', () => {
    expect(getMissingToyFields(toy({ switch_adapted: false, switch_photo_urls: [] }))).toEqual([])
  })

  it('requires at least one switch photo when switch-adapted', () => {
    expect(getMissingToyFields(toy({ switch_adapted: true, switch_photo_urls: [] }))).toEqual([
      { step: 'photos', label: 'A switch photo' },
    ])
  })

  it('is satisfied once a switch photo exists', () => {
    expect(
      getMissingToyFields(toy({ switch_adapted: true, switch_photo_urls: ['https://x/switch-1.jpg'] }))
    ).toEqual([])
  })

  it('flags a missing offer type, pointing at Review rather than Photos', () => {
    expect(getMissingToyFields(toy({ offer_type: null }))).toEqual([
      { step: 'review', label: 'How it is offered' },
    ])
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

  it('does not flag photos for a missing offer type — that belongs to Review', () => {
    expect(computeToyStepStatuses(toy({ offer_type: null })).photos).toBe('done')
  })

  it('review is neutral while draft and done once published', () => {
    expect(computeToyStepStatuses(toy({ status: 'draft' })).review).toBe('neutral')
    expect(computeToyStepStatuses(toy({ status: 'published' })).review).toBe('done')
  })
})
