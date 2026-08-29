import { describe, it, expect } from 'vitest'
import { computeStepStatuses, stepsFor } from '@/lib/edit-steps'
import type { TutorialWithDetails } from '@splat-connect/types'

function tutorial(overrides: Partial<TutorialWithDetails> = {}): TutorialWithDetails {
  return {
    id: 't1',
    title: 'Spoon Holder',
    description: null,
    difficulty: 'easy',
    kind: 'toy_adaptation',
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
    tutorial_recommendations: [],
    tutorial_contributors: [
      {
        tutorial_id: 't1',
        profile_id: 'p1',
        role: 'primary',
        added_at: '',
        profiles: { id: 'p1', name: 'Primary', email: 'p@test.local', role: 'contributor', created_at: '', public_showcase: true },
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

  // The STL pill is a required step for assistive tech and not a step at all
  // for a toy adaptation, so its dot only ever means something for the former.
  it('stl needs attention on an assistive-tech tutorial with no file, done once one exists', () => {
    expect(computeStepStatuses(tutorial({ kind: 'assistive_tech', stl_files: [] }), []).stl).toBe('attention')
    expect(
      computeStepStatuses(
        tutorial({ kind: 'assistive_tech', stl_files: [{ id: 's1', tutorial_id: 't1', filename: 'a.stl', file_url: 'https://x/a.stl' }] }),
        []
      ).stl
    ).toBe('done')
  })

  it('stl is never flagged on a toy adaptation', () => {
    expect(computeStepStatuses(tutorial({ stl_files: [] }), []).stl).toBe('done')
  })

  it('recommended is neutral when empty and done once one exists', () => {
    expect(computeStepStatuses(tutorial(), []).recommended).toBe('neutral')
    expect(
      computeStepStatuses(
        tutorial({
          tutorial_recommendations: [
            { position: 1, tutorials: { id: 't2', title: 'Other', kind: 'toy_adaptation', difficulty: 'easy', toy_photo_url: null, status: 'approved' } },
          ],
        }),
        []
      ).recommended
    ).toBe('done')
  })

  it('team is neutral when the contributor is alone and nobody has been asked', () => {
    expect(computeStepStatuses(tutorial(), []).team).toBe('neutral')
  })

  // Either half on its own is enough — the two used to be separate steps with
  // a dot each, and merging them must not make one of them stop counting.
  it('team is done once an organisation has been asked, with no collaborator', () => {
    expect(
      computeStepStatuses(tutorial(), [
        { id: 'b1', tutorial_id: 't1', org_id: 'o1', status: 'pending', requested_at: '', responded_at: null, responded_by: null },
      ]).team
    ).toBe('done')
  })

  it('team is done once a second contributor joins, with no backing', () => {
    const withCollaborator = tutorial({
      tutorial_contributors: [
        ...tutorial().tutorial_contributors,
        {
          tutorial_id: 't1',
          profile_id: 'p2',
          role: 'collaborator',
          added_at: '',
          profiles: { id: 'p2', name: 'Jane', email: 'j@test.local', role: 'contributor', created_at: '', public_showcase: true },
        },
      ],
    })
    expect(computeStepStatuses(withCollaborator, []).team).toBe('done')
  })
})

describe('stepsFor', () => {
  it('a toy adaptation never shows the STL pill', () => {
    expect(stepsFor('toy_adaptation')).toEqual(['details', 'files', 'parts', 'tools', 'recommended', 'review', 'team'])
  })

  it('an assistive-tech tutorial has STL between tools and review', () => {
    expect(stepsFor('assistive_tech')).toEqual(['details', 'files', 'parts', 'tools', 'stl', 'recommended', 'review', 'team'])
  })
})
