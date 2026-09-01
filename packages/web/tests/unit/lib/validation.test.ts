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
  maturity: 'complete',
  safety_declared_at: '2026-08-01T00:00:00Z',
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
  // Chain: an empty list is what enables the submit bar's action
  it('returns empty array when all fields are present', () => {
    expect(getMissingFields(baseTutorial)).toEqual([])
  })

  // Chain: the gap chip names the field and opens the step that fixes it, so
  //        the step it is paired with is half the answer — a label alone was
  //        what the old edit-steps.ts translation table existed to make good
  it('pairs a missing title with the Details step', () => {
    expect(getMissingFields({ ...baseTutorial, title: '' })).toContainEqual({
      step: 'details',
      label: 'A title',
    })
  })

  it('pairs a difficulty that is not one of the three with Details', () => {
    expect(
      getMissingFields({
        ...baseTutorial,
        difficulty: 'extreme' as TutorialWithDetails['difficulty'],
      })
    ).toContainEqual({ step: 'details', label: 'A difficulty' })
  })

  it('pairs a missing guide PDF with the Files step', () => {
    expect(getMissingFields({ ...baseTutorial, tutorial_pdf_url: null })).toContainEqual({
      step: 'files',
      label: 'The guide PDF',
    })
  })

  it('pairs a missing photo with the Files step', () => {
    expect(getMissingFields({ ...baseTutorial, toy_photo_url: null })).toContainEqual({
      step: 'files',
      label: 'A photo',
    })
  })

  // The only kind-aware rule. An assistive-tech tutorial is its printed part;
  // a toy adaptation has no STL step to send anyone back to.
  it('requires an STL file for assistive tech only', () => {
    const stlGap = { step: 'stl', label: 'A 3D-print file' }
    expect(getMissingFields({ ...baseTutorial, kind: 'assistive_tech', stl_files: [] })).toContainEqual(stlGap)
    expect(getMissingFields({ ...baseTutorial, kind: 'toy_adaptation', stl_files: [] })).not.toContainEqual(stlGap)
    expect(
      getMissingFields({
        ...baseTutorial,
        kind: 'assistive_tech',
        stl_files: [{ id: 's1', tutorial_id: 'tut-1', filename: 'a.stl', file_url: 'https://x/a.stl' }],
      })
    ).toEqual([])
  })

  it('pairs an empty parts list with the Parts step', () => {
    expect(getMissingFields({ ...baseTutorial, parts: [] })).toContainEqual({
      step: 'parts',
      label: 'A part',
    })
  })

  it('pairs an empty tools list with the Tools step', () => {
    expect(getMissingFields({ ...baseTutorial, tools: [] })).toContainEqual({
      step: 'tools',
      label: 'A tool',
    })
  })

  // Chain: the bar renders these in order, and reading "A photo" before "The
  //        guide PDF" would not match the order the Files step asks for them
  it('lists gaps in step order', () => {
    expect(
      getMissingFields({ ...baseTutorial, title: '', tutorial_pdf_url: null, tools: [] })
    ).toEqual([
      { step: 'details', label: 'A title' },
      { step: 'files', label: 'The guide PDF' },
      { step: 'tools', label: 'A tool' },
    ])
  })
})
