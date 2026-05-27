import { describe, it, expect } from 'vitest'
import { canAdvanceFromStep, canSubmit, getMissingFields } from '@/lib/validation'
import type { UploadDraft, TutorialWithDetails } from '@splat-connect/types'

const baseDraft: UploadDraft = {
  title: 'Test Tutorial',
  description: '',
  difficulty: 'easy',
  tutorial_pdf_url: 'https://example.com/tutorial.pdf',
  toy_photo_url: 'https://example.com/photo.jpg',
  parts: [{ name: 'Screw', quantity: 2, is_optional: false, buy_links: [] }],
  tools: [{ name: 'Screwdriver', is_optional: false, buy_links: [] }],
  stl_files: [],
}

describe('canAdvanceFromStep', () => {
  describe('step 1', () => {
    it('returns true with valid title and difficulty', () => {
      expect(canAdvanceFromStep(1, baseDraft)).toBe(true)
    })

    it('returns false with empty title', () => {
      expect(canAdvanceFromStep(1, { ...baseDraft, title: '' })).toBe(false)
    })

    it('returns false with whitespace-only title', () => {
      expect(canAdvanceFromStep(1, { ...baseDraft, title: '   ' })).toBe(false)
    })

    it('returns false with invalid difficulty', () => {
      expect(canAdvanceFromStep(1, { ...baseDraft, difficulty: 'extreme' as any })).toBe(false)
    })

    it('returns true for each valid difficulty', () => {
      expect(canAdvanceFromStep(1, { ...baseDraft, difficulty: 'easy' })).toBe(true)
      expect(canAdvanceFromStep(1, { ...baseDraft, difficulty: 'medium' })).toBe(true)
      expect(canAdvanceFromStep(1, { ...baseDraft, difficulty: 'hard' })).toBe(true)
    })
  })

  describe('step 2', () => {
    it('returns true with both URLs present', () => {
      expect(canAdvanceFromStep(2, baseDraft)).toBe(true)
    })

    it('returns false with missing pdf URL', () => {
      expect(canAdvanceFromStep(2, { ...baseDraft, tutorial_pdf_url: null })).toBe(false)
    })

    it('returns false with missing photo URL', () => {
      expect(canAdvanceFromStep(2, { ...baseDraft, toy_photo_url: null })).toBe(false)
    })
  })

  describe('step 3', () => {
    it('returns true with at least one valid part', () => {
      expect(canAdvanceFromStep(3, baseDraft)).toBe(true)
    })

    it('returns false with empty parts array', () => {
      expect(canAdvanceFromStep(3, { ...baseDraft, parts: [] })).toBe(false)
    })

    it('returns false when part name is empty', () => {
      expect(
        canAdvanceFromStep(3, {
          ...baseDraft,
          parts: [{ name: '', quantity: 1, is_optional: false, buy_links: [] }],
        })
      ).toBe(false)
    })

    it('returns false when quantity is zero', () => {
      expect(
        canAdvanceFromStep(3, {
          ...baseDraft,
          parts: [{ name: 'Screw', quantity: 0, is_optional: false, buy_links: [] }],
        })
      ).toBe(false)
    })

    it('returns false when quantity is non-integer', () => {
      expect(
        canAdvanceFromStep(3, {
          ...baseDraft,
          parts: [{ name: 'Screw', quantity: 1.5, is_optional: false, buy_links: [] }],
        })
      ).toBe(false)
    })
  })

  describe('step 4', () => {
    it('returns true with at least one valid tool', () => {
      expect(canAdvanceFromStep(4, baseDraft)).toBe(true)
    })

    it('returns false with empty tools array', () => {
      expect(canAdvanceFromStep(4, { ...baseDraft, tools: [] })).toBe(false)
    })

    it('returns false when tool name is empty', () => {
      expect(
        canAdvanceFromStep(4, {
          ...baseDraft,
          tools: [{ name: '', is_optional: false, buy_links: [] }],
        })
      ).toBe(false)
    })
  })

  describe('step 5', () => {
    it('always returns true (STL files are optional)', () => {
      expect(canAdvanceFromStep(5, { ...baseDraft, stl_files: [] })).toBe(true)
    })
  })

  describe('step 6', () => {
    it('returns true when all required steps pass', () => {
      expect(canAdvanceFromStep(6, baseDraft)).toBe(true)
    })
  })

  describe('unknown step', () => {
    it('returns false for unknown step numbers', () => {
      expect(canAdvanceFromStep(99, baseDraft)).toBe(false)
    })
  })
})

describe('canSubmit', () => {
  it('returns true when all required fields are valid', () => {
    expect(canSubmit(baseDraft)).toBe(true)
  })

  it('returns false when title is missing', () => {
    expect(canSubmit({ ...baseDraft, title: '' })).toBe(false)
  })

  it('returns false when parts are empty', () => {
    expect(canSubmit({ ...baseDraft, parts: [] })).toBe(false)
  })
})

const baseTutorial: TutorialWithDetails = {
  id: 'tut-1',
  title: 'My Tutorial',
  description: null,
  difficulty: 'easy',
  status: 'draft',
  tutorial_pdf_url: 'https://example.com/tutorial.pdf',
  toy_photo_url: 'https://example.com/photo.jpg',
  rejection_note: null,
  created_at: '2026-01-01T00:00:00Z',
  reviewed_at: null,
  parts: [{ id: 'p-1', tutorial_id: 'tut-1', name: 'Screw', quantity: 4, is_optional: false, buy_links: [] }],
  tools: [{ id: 't-1', tutorial_id: 'tut-1', name: 'Screwdriver', is_optional: false, buy_links: [] }],
  stl_files: [],
  tutorial_contributors: [],
}

describe('getMissingFields', () => {
  it('returns empty array when all fields are present', () => {
    expect(getMissingFields(baseTutorial)).toEqual([])
  })

  it('includes "Title" when title is empty', () => {
    expect(getMissingFields({ ...baseTutorial, title: '' })).toContain('Title')
  })

  it('includes "Tutorial PDF" when tutorial_pdf_url is null', () => {
    expect(getMissingFields({ ...baseTutorial, tutorial_pdf_url: null })).toContain('Tutorial PDF')
  })

  it('includes "Toy photo" when toy_photo_url is null', () => {
    expect(getMissingFields({ ...baseTutorial, toy_photo_url: null })).toContain('Toy photo')
  })

  it('includes "At least one part" when parts array is empty', () => {
    expect(getMissingFields({ ...baseTutorial, parts: [] })).toContain('At least one part')
  })

  it('includes "At least one tool" when tools array is empty', () => {
    expect(getMissingFields({ ...baseTutorial, tools: [] })).toContain('At least one tool')
  })
})
