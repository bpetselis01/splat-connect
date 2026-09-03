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
    photo_urls: ['https://example.com/cover.jpg'],
    cover_photo_url: 'https://example.com/cover.jpg',
    switch_photo_url: null,
    status: 'draft',
    created_at: '',
    updated_at: '',
    offer_type: 'donation',
    ...overrides,
  }
}

// Each gap carries the step that closes it, so the publish bar can name what
// is missing and hand over the fix in one gesture. Offer type is chosen in the
// Review panel, which is why it points there rather than at Photos.
describe('getMissingToyFields', () => {
  it('flags having no photos at all, pointing at Photos', () => {
    expect(getMissingToyFields(toy({ photo_urls: [] }))).toEqual([
      { step: 'photos', label: 'A photo' },
    ])
  })

  it('does not ask which photo shows the switch when not switch-adapted', () => {
    expect(getMissingToyFields(toy({ switch_adapted: false, switch_photo_url: null }))).toEqual([])
  })

  // The rule is that the switch was pictured, not that a second file exists —
  // so five untagged photos is still a gap, and one tagged photo closes it.
  it('requires a tagged photo when switch-adapted, however many are uploaded', () => {
    expect(
      getMissingToyFields(
        toy({
          switch_adapted: true,
          switch_photo_url: null,
          photo_urls: ['https://x/1.jpg', 'https://x/2.jpg'],
        })
      )
    ).toEqual([{ step: 'photos', label: 'A photo showing the switch' }])
  })

  it('is satisfied once one of the photos is tagged as showing the switch', () => {
    expect(
      getMissingToyFields(
        toy({
          switch_adapted: true,
          photo_urls: ['https://x/cover.jpg', 'https://x/switch-1.jpg'],
          switch_photo_url: 'https://x/switch-1.jpg',
        })
      )
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

  it('flags photos as attention when there are none', () => {
    expect(computeToyStepStatuses(toy({ photo_urls: [] })).photos).toBe('attention')
  })

  it('flags photos as attention when switch-adapted but nothing is tagged', () => {
    expect(
      computeToyStepStatuses(toy({ switch_adapted: true, switch_photo_url: null })).photos
    ).toBe('attention')
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
