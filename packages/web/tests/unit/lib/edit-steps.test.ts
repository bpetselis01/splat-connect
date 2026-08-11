import { describe, it, expect } from 'vitest'
import { computeStepStatuses } from '@/lib/edit-steps'
import type { TutorialWithDetails } from '@splat-connect/types'

function tutorial(overrides: Partial<TutorialWithDetails> = {}): TutorialWithDetails {
  return {
    id: 't1',
    title: 'Spoon Holder',
    description: null,
    difficulty: 'easy',
    status: 'draft',
    toy_photo_url: 'https://example.com/photo.jpg',
    tutorial_pdf_url: 'https://example.com/tutorial.pdf',
    rejection_note: null,
    created_at: '',
    updated_at: '',
    reviewed_at: null,
    reviewed_by: null,
    reviewed_for_org_id: null,
    parts: [{ id: 'p1', tutorial_id: 't1', name: 'Screw', quantity: 4, is_optional: false, buy_links: [] }],
    tools: [{ id: 'to1', tutorial_id: 't1', name: 'Screwdriver', is_optional: false, buy_links: [] }],
    stl_files: [],
    tutorial_contributors: [
      {
        tutorial_id: 't1',
        profile_id: 'p1',
        role: 'primary',
        added_at: '',
        profiles: { id: 'p1', name: 'Primary', email: 'p@test.local', role: 'contributor', created_at: '' },
      },
    ],
    ...overrides,
  }
}

describe('computeStepStatuses', () => {
  it('marks details, files, parts, tools done when all required fields are present', () => {
    const statuses = computeStepStatuses(tutorial(), [])
    expect(statuses.details).toBe('done')
    expect(statuses.files).toBe('done')
    expect(statuses.parts).toBe('done')
    expect(statuses.tools).toBe('done')
  })

  it('flags details as attention when title is missing', () => {
    const statuses = computeStepStatuses(tutorial({ title: '' }), [])
    expect(statuses.details).toBe('attention')
  })

  it('does not flag details for a missing description', () => {
    const statuses = computeStepStatuses(tutorial({ description: null }), [])
    expect(statuses.details).toBe('done')
  })

  it('flags files as attention when either the photo or PDF is missing', () => {
    const statuses = computeStepStatuses(tutorial({ toy_photo_url: null }), [])
    expect(statuses.files).toBe('attention')
  })

  it('flags parts as attention when there are zero parts', () => {
    const statuses = computeStepStatuses(tutorial({ parts: [] }), [])
    expect(statuses.parts).toBe('attention')
  })

  it('flags tools as attention when there are zero tools', () => {
    const statuses = computeStepStatuses(tutorial({ tools: [] }), [])
    expect(statuses.tools).toBe('attention')
  })

  it('stl is neutral when empty and done once a file exists', () => {
    expect(computeStepStatuses(tutorial({ stl_files: [] }), []).stl).toBe('neutral')
    expect(
      computeStepStatuses(tutorial({ stl_files: [{ id: 's1', tutorial_id: 't1', filename: 'a.stl', file_url: 'https://x/a.stl' }] }), [])
        .stl
    ).toBe('done')
  })

  it('backing is neutral when no organisation has been asked and done once one has', () => {
    expect(computeStepStatuses(tutorial(), []).backing).toBe('neutral')
    expect(
      computeStepStatuses(tutorial(), [
        { id: 'b1', tutorial_id: 't1', org_id: 'o1', status: 'pending', requested_at: '', responded_at: null, responded_by: null },
      ]).backing
    ).toBe('done')
  })

  it('collaborators is neutral with only the primary and done once a second contributor joins', () => {
    expect(computeStepStatuses(tutorial(), []).collaborators).toBe('neutral')
    const withCollaborator = tutorial({
      tutorial_contributors: [
        ...tutorial().tutorial_contributors,
        {
          tutorial_id: 't1',
          profile_id: 'p2',
          role: 'collaborator',
          added_at: '',
          profiles: { id: 'p2', name: 'Jane', email: 'j@test.local', role: 'contributor', created_at: '' },
        },
      ],
    })
    expect(computeStepStatuses(withCollaborator, []).collaborators).toBe('done')
  })
})
