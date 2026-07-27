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
    // Tests: a draft with a non-empty title and a valid difficulty can advance from Step 1
    // How:   passes baseDraft (title 'Test Tutorial', difficulty 'easy') to canAdvanceFromStep(1); checks true
    // Chain: the upload wizard uses this return value to enable the Next button → users can only
    //        proceed to Step 2 after providing the two required Step 1 fields
    it('returns true with valid title and difficulty', () => {
      expect(canAdvanceFromStep(1, baseDraft)).toBe(true)
    })

    // Tests: a draft with an empty title cannot advance from Step 1
    // How:   spreads baseDraft with title: ''; checks canAdvanceFromStep(1) returns false
    // Chain: the Next button stays disabled → the wizard cannot POST a draft without a title,
    //        preventing incomplete records from being created in the database
    it('returns false with empty title', () => {
      expect(canAdvanceFromStep(1, { ...baseDraft, title: '' })).toBe(false)
    })

    // Tests: a title containing only whitespace is treated as empty and blocks Step 1 advancement
    // How:   spreads baseDraft with title: '   '; checks return is false
    // Chain: prevents tutorials with a whitespace-only title from reaching the API → database
    //        records always have a meaningful, non-blank title
    it('returns false with whitespace-only title', () => {
      expect(canAdvanceFromStep(1, { ...baseDraft, title: '   ' })).toBe(false)
    })

    // Tests: a difficulty value outside the allowed set (easy/medium/hard) blocks Step 1
    // How:   passes difficulty: 'extreme' as any; checks return is false
    // Chain: the difficulty buttons in the UI only emit valid values, but this check guards
    //        against programmatic misuse → the API always receives a valid difficulty enum value
    it('returns false with invalid difficulty', () => {
      expect(canAdvanceFromStep(1, { ...baseDraft, difficulty: 'extreme' as any })).toBe(false)
    })

    // Tests: each of the three valid difficulty values allows advancement from Step 1
    // How:   calls canAdvanceFromStep(1, ...) with easy, medium, and hard; all return true
    // Chain: the three difficulty buttons each produce a passing result → the wizard is not
    //        accidentally over-restrictive in what difficulty choices it accepts
    it('returns true for each valid difficulty', () => {
      expect(canAdvanceFromStep(1, { ...baseDraft, difficulty: 'easy' })).toBe(true)
      expect(canAdvanceFromStep(1, { ...baseDraft, difficulty: 'medium' })).toBe(true)
      expect(canAdvanceFromStep(1, { ...baseDraft, difficulty: 'hard' })).toBe(true)
    })
  })

  describe('step 2', () => {
    // Tests: a draft with both tutorial_pdf_url and toy_photo_url set can advance from Step 2
    // How:   passes baseDraft (both URLs set) to canAdvanceFromStep(2); checks true
    // Chain: the Next button enables only after both file uploads complete → the tutorial record
    //        always has both a PDF and a photo URL before the parts step begins
    it('returns true with both URLs present', () => {
      expect(canAdvanceFromStep(2, baseDraft)).toBe(true)
    })

    // Tests: a missing tutorial_pdf_url prevents advancement from Step 2
    // How:   spreads baseDraft with tutorial_pdf_url: null; checks return is false
    // Chain: the Next button stays disabled until the PDF upload API call returns a URL →
    //        ensures the PDF is persisted before the wizard moves on
    it('returns false with missing pdf URL', () => {
      expect(canAdvanceFromStep(2, { ...baseDraft, tutorial_pdf_url: null })).toBe(false)
    })

    // Tests: a missing toy_photo_url prevents advancement from Step 2
    // How:   spreads baseDraft with toy_photo_url: null; checks return is false
    // Chain: the Next button stays disabled until the photo upload completes → every tutorial
    //        has a cover image before reaching the parts step
    it('returns false with missing photo URL', () => {
      expect(canAdvanceFromStep(2, { ...baseDraft, toy_photo_url: null })).toBe(false)
    })
  })

  describe('step 3', () => {
    // Tests: a draft with at least one part with a non-empty name and positive quantity can advance from Step 3
    // How:   passes baseDraft (one valid part) to canAdvanceFromStep(3); checks true
    // Chain: enables the Step 3 Next button → the parts list is POSTed to the API only when
    //        at least one valid part exists
    it('returns true with at least one valid part', () => {
      expect(canAdvanceFromStep(3, baseDraft)).toBe(true)
    })

    // Tests: an empty parts array prevents advancement from Step 3
    // How:   spreads baseDraft with parts: []; checks return is false
    // Chain: the wizard cannot advance to Step 4 without at least one part → every published
    //        tutorial has a non-empty parts list for users to reference
    it('returns false with empty parts array', () => {
      expect(canAdvanceFromStep(3, { ...baseDraft, parts: [] })).toBe(false)
    })

    // Tests: a part with an empty name prevents advancement from Step 3
    // How:   passes a part with name: ''; checks return is false
    // Chain: prevents unnamed parts from reaching the API → every part in the database has
    //        a meaningful label visible on the tutorial detail page
    it('returns false when part name is empty', () => {
      expect(
        canAdvanceFromStep(3, {
          ...baseDraft,
          parts: [{ name: '', quantity: 1, is_optional: false, buy_links: [] }],
        })
      ).toBe(false)
    })

    // Tests: a part with quantity zero prevents advancement from Step 3
    // How:   passes quantity: 0; checks return is false
    // Chain: every part record has a quantity of at least 1 → the parts list on the tutorial
    //        detail page always shows actionable "how many to buy" counts
    it('returns false when quantity is zero', () => {
      expect(
        canAdvanceFromStep(3, {
          ...baseDraft,
          parts: [{ name: 'Screw', quantity: 0, is_optional: false, buy_links: [] }],
        })
      ).toBe(false)
    })

    // Tests: a part with a non-integer quantity (e.g. 1.5) prevents advancement from Step 3
    // How:   passes quantity: 1.5; checks return is false
    // Chain: part quantities are stored as integers in the DB → validation ensures the value
    //        is both positive and a whole number before it reaches the API
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
    // Tests: a draft with at least one tool with a non-empty name can advance from Step 4
    // How:   passes baseDraft (one valid tool) to canAdvanceFromStep(4); checks true
    // Chain: enables the Step 4 Next button → the tools list is POSTed to the API only when
    //        at least one valid tool exists
    it('returns true with at least one valid tool', () => {
      expect(canAdvanceFromStep(4, baseDraft)).toBe(true)
    })

    // Tests: an empty tools array prevents advancement from Step 4
    // How:   spreads baseDraft with tools: []; checks return is false
    // Chain: every tutorial has at least one tool listed → users can see what equipment
    //        they need before starting the adaptation project
    it('returns false with empty tools array', () => {
      expect(canAdvanceFromStep(4, { ...baseDraft, tools: [] })).toBe(false)
    })

    // Tests: a tool with an empty name prevents advancement from Step 4
    // How:   passes a tool with name: ''; checks return is false
    // Chain: prevents unnamed tools from being saved to the DB → every tool record has a
    //        name that makes sense on the tutorial detail page
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
    // Tests: Step 5 always allows advancement regardless of the STL files array
    // How:   passes stl_files: [] to canAdvanceFromStep(5); checks true
    // Chain: STL files are optional — the wizard skips the stl-files API call when the array
    //        is empty → tutorials without printable parts don't require an STL file
    it('always returns true (STL files are optional)', () => {
      expect(canAdvanceFromStep(5, { ...baseDraft, stl_files: [] })).toBe(true)
    })
  })

  describe('step 6', () => {
    // Tests: Step 6 returns true when all required data from prior steps is present
    // How:   passes baseDraft (all required fields populated) to canAdvanceFromStep(6); checks true
    // Chain: enables the Submit button → the final submit only PATCHes status to 'pending',
    //        trusting that prior steps have already validated and saved all required data
    it('returns true when all required steps pass', () => {
      expect(canAdvanceFromStep(6, baseDraft)).toBe(true)
    })
  })

  describe('unknown step', () => {
    // Tests: an unrecognised step number returns false
    // How:   passes step 99 to canAdvanceFromStep; checks return is false
    // Chain: prevents the wizard from advancing if called with an out-of-range step number →
    //        a defensive fallback that keeps the wizard in a valid state
    it('returns false for unknown step numbers', () => {
      expect(canAdvanceFromStep(99, baseDraft)).toBe(false)
    })
  })
})

describe('canSubmit', () => {
  // Tests: canSubmit returns true when all required fields for submission are present
  // How:   passes baseDraft (all fields set) to canSubmit; checks true
  // Chain: enables the Submit for Review button on Step 6 → the user can only submit a
  //        tutorial that has all required data already saved
  it('returns true when all required fields are valid', () => {
    expect(canSubmit(baseDraft)).toBe(true)
  })

  // Tests: canSubmit returns false when the title is empty
  // How:   spreads baseDraft with title: ''; checks false
  // Chain: the Submit button remains disabled → the API is never called with a titleless
  //        tutorial, maintaining data quality in the pending review queue
  it('returns false when title is missing', () => {
    expect(canSubmit({ ...baseDraft, title: '' })).toBe(false)
  })

  // Tests: canSubmit returns false when the parts array is empty
  // How:   spreads baseDraft with parts: []; checks false
  // Chain: the Submit button stays disabled → tutorials cannot enter the review queue
  //        without at least one part, ensuring reviewers always see complete content
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
  org_id: null,
  review_level: null,
  reviewed_by: null,
  flagged_for_follow_up: false,
}

describe('getMissingFields', () => {
  // Tests: getMissingFields returns an empty array when all required fields are populated
  // How:   passes baseTutorial (all fields set) to getMissingFields; checks result equals []
  // Chain: an empty array means no warning banner is shown on the tutorial edit page →
  //        the contributor sees a clean form when their tutorial is ready to submit
  it('returns empty array when all fields are present', () => {
    expect(getMissingFields(baseTutorial)).toEqual([])
  })

  // Tests: getMissingFields includes 'Title' when the title is empty
  // How:   spreads baseTutorial with title: ''; checks result contains 'Title'
  // Chain: the edit page renders a "Missing: Title" warning → the contributor knows which
  //        field to fill in before they can submit for review
  it('includes "Title" when title is empty', () => {
    expect(getMissingFields({ ...baseTutorial, title: '' })).toContain('Title')
  })

  // Tests: getMissingFields includes 'Tutorial PDF' when tutorial_pdf_url is null
  // How:   spreads baseTutorial with tutorial_pdf_url: null; checks result contains 'Tutorial PDF'
  // Chain: the edit page shows a missing-file warning → contributors are guided to upload
  //        the PDF before attempting to submit for review
  it('includes "Tutorial PDF" when tutorial_pdf_url is null', () => {
    expect(getMissingFields({ ...baseTutorial, tutorial_pdf_url: null })).toContain('Tutorial PDF')
  })

  // Tests: getMissingFields includes 'Toy photo' when toy_photo_url is null
  // How:   spreads baseTutorial with toy_photo_url: null; checks result contains 'Toy photo'
  // Chain: the edit page shows a missing-photo warning → tutorials in the review queue
  //        always have a cover image when admins evaluate them
  it('includes "Toy photo" when toy_photo_url is null', () => {
    expect(getMissingFields({ ...baseTutorial, toy_photo_url: null })).toContain('Toy photo')
  })

  // Tests: getMissingFields includes 'At least one part' when the parts array is empty
  // How:   spreads baseTutorial with parts: []; checks result contains 'At least one part'
  // Chain: the edit page shows a missing-parts warning → contributors know to add parts
  //        before the Submit button becomes active
  it('includes "At least one part" when parts array is empty', () => {
    expect(getMissingFields({ ...baseTutorial, parts: [] })).toContain('At least one part')
  })

  // Tests: getMissingFields includes 'At least one tool' when the tools array is empty
  // How:   spreads baseTutorial with tools: []; checks result contains 'At least one tool'
  // Chain: the edit page shows a missing-tools warning → contributors know to add tools,
  //        ensuring reviewers always see a complete equipment list
  it('includes "At least one tool" when tools array is empty', () => {
    expect(getMissingFields({ ...baseTutorial, tools: [] })).toContain('At least one tool')
  })
})
