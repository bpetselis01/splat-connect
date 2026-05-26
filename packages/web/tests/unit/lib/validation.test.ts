import { describe, it, expect } from 'vitest'
import { canAdvanceFromStep, canSubmit } from '@/lib/validation'
import type { UploadDraft } from '@splat-connect/types'

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
