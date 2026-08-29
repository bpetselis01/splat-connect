import { describe, it, expect } from 'vitest'
import { getMissingFields } from '@/lib/validation'
import type { TutorialWithDetails } from '@splat-connect/types'

const baseTutorial: TutorialWithDetails = {
  id: 'tut-1',
  title: 'My Tutorial',
  description: null,
  difficulty: 'easy',
  kind: 'toy_adaptation',
  status: 'draft',
  tutorial_pdf_url: 'https://example.com/tutorial.pdf',
  toy_photo_url: 'https://example.com/photo.jpg',
  rejection_note: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  reviewed_at: null,
  parts: [{ id: 'p-1', tutorial_id: 'tut-1', name: 'Screw', quantity: 4, is_optional: false, buy_links: [] }],
  tools: [{ id: 't-1', tutorial_id: 'tut-1', name: 'Screwdriver', is_optional: false, buy_links: [] }],
  stl_files: [],
  tutorial_recommendations: [],
  tutorial_contributors: [],
  reviewed_by: null,
  reviewed_for_org_id: null,
}

describe('getMissingFields', () => {
  // Chain: an empty list is what enables the Review step's Submit button
  it('returns empty array when all fields are present', () => {
    expect(getMissingFields(baseTutorial)).toEqual([])
  })

  // Chain: the Review step names the missing field → the contributor knows
  //        which step to go back to before they can submit
  it('includes "Title" when title is empty', () => {
    expect(getMissingFields({ ...baseTutorial, title: '' })).toContain('Title')
  })

  it('includes "Difficulty" when difficulty is not one of the three', () => {
    expect(
      getMissingFields({
        ...baseTutorial,
        difficulty: 'extreme' as TutorialWithDetails['difficulty'],
      })
    ).toContain('Difficulty')
  })

  it('includes "Tutorial PDF" when tutorial_pdf_url is null', () => {
    expect(getMissingFields({ ...baseTutorial, tutorial_pdf_url: null })).toContain('Tutorial PDF')
  })

  it('includes "Photo" when toy_photo_url is null', () => {
    expect(getMissingFields({ ...baseTutorial, toy_photo_url: null })).toContain('Photo')
  })

  // The only kind-aware rule. An assistive-tech tutorial is its printed part;
  // a toy adaptation has no STL step to send anyone back to.
  it('requires an STL file for assistive tech only', () => {
    expect(getMissingFields({ ...baseTutorial, kind: 'assistive_tech', stl_files: [] })).toContain('At least one STL file')
    expect(getMissingFields({ ...baseTutorial, kind: 'toy_adaptation', stl_files: [] })).not.toContain('At least one STL file')
    expect(
      getMissingFields({
        ...baseTutorial,
        kind: 'assistive_tech',
        stl_files: [{ id: 's1', tutorial_id: 'tut-1', filename: 'a.stl', file_url: 'https://x/a.stl' }],
      })
    ).toEqual([])
  })

  it('includes "At least one part" when parts array is empty', () => {
    expect(getMissingFields({ ...baseTutorial, parts: [] })).toContain('At least one part')
  })

  it('includes "At least one tool" when tools array is empty', () => {
    expect(getMissingFields({ ...baseTutorial, tools: [] })).toContain('At least one tool')
  })
})
