import {
  getMissingFields,
  sectionProgress,
  sectionsFor,
  sectionSummary,
  SECTION_LABEL,
} from '../../../lib/tutorial-sections'
import type { TutorialWithDetails } from '@splat-connect/types'

const base = (over: Partial<TutorialWithDetails> = {}): TutorialWithDetails =>
  ({
    id: 't1',
    title: 'A guide',
    description: null,
    kind: 'toy_adaptation',
    difficulty: 'easy',
    maturity: 'complete',
    status: 'draft',
    updated_at: '2026-09-02T00:00:00Z',
    safety_declared_at: '2026-09-02T00:00:00Z',
    build_minutes: 30,
    tutorial_pdf_url: 'p.pdf',
    photo_urls: ['p.jpg'],
    toy_photo_url: 'p.jpg',
    parts: [{ name: 'Switch' }],
    tools: [{ name: 'Screwdriver' }],
    stl_files: [],
    tutorial_contributors: [],
    tutorial_recommendations: [],
    ...over,
  }) as unknown as TutorialWithDetails

describe('getMissingFields', () => {
  it('reports nothing for a complete toy adaptation', () => {
    expect(getMissingFields(base())).toEqual([])
  })

  // The one divergence from web's lib/validation.ts, deliberate: safety is its
  // own row on the hub, so its gap must route there rather than to Details.
  it('routes the safety gap to its own section, not to details', () => {
    const gaps = getMissingFields(base({ safety_declared_at: null }))
    expect(gaps).toEqual([{ section: 'safety', label: 'The safety declaration' }])
  })

  it('reports every gap of an empty draft, each against the section that closes it', () => {
    const gaps = getMissingFields(
      base({
        title: '  ',
        difficulty: 'nonsense' as never,
        tutorial_pdf_url: null,
        photo_urls: [],
        toy_photo_url: null,
        parts: [],
        tools: [],
        safety_declared_at: null,
        build_minutes: null,
      })
    )
    expect(gaps).toEqual([
      { section: 'details', label: 'A title' },
      { section: 'details', label: 'A difficulty' },
      { section: 'details', label: 'A build time' },
      { section: 'files', label: 'The guide PDF' },
      { section: 'files', label: 'A photo' },
      { section: 'parts', label: 'A part' },
      { section: 'tools', label: 'A tool' },
      { section: 'safety', label: 'The safety declaration' },
    ])
  })

  it('requires an STL only for assistive tech', () => {
    expect(getMissingFields(base({ kind: 'toy_adaptation', stl_files: [] }))).toEqual([])
    expect(getMissingFields(base({ kind: 'assistive_tech', stl_files: [] }))).toEqual([
      { section: 'stl', label: 'A 3D-print file' },
    ])
  })
})

describe('sectionsFor', () => {
  it('gives a toy adaptation seven sections and no STL', () => {
    expect(sectionsFor('toy_adaptation')).toEqual(['details', 'steps', 'parts', 'tools', 'safety', 'suits', 'files'])
  })

  it('adds STL for assistive tech', () => {
    expect(sectionsFor('assistive_tech')).toEqual([
      'details',
      'steps',
      'parts',
      'tools',
      'safety',
      'suits',
      'files',
      'stl',
    ])
  })
})

describe('sectionSummary', () => {
  it('says what is missing, in the words the row shows', () => {
    expect(sectionSummary('parts', base({ parts: [] }))).toBe('None yet - at least one')
    expect(sectionSummary('tools', base({ tools: [] }))).toBe('None yet - at least one')
    expect(sectionSummary('files', base({ tutorial_pdf_url: null, photo_urls: [] }))).toBe(
      'Guide PDF and a photo'
    )
    expect(sectionSummary('files', base({ photo_urls: [] }))).toBe('A photo')
    expect(sectionSummary('stl', base({ kind: 'assistive_tech', stl_files: [] }))).toBe(
      'No STL yet'
    )
    expect(sectionSummary('safety', base({ safety_declared_at: null }))).toBe('Not declared yet')
    expect(sectionSummary('details', base({ build_minutes: null }))).toBe(
      'Toy adaptation - Easy - no build time yet'
    )
  })

  it('describes what is there once a section is complete', () => {
    expect(sectionSummary('details', base())).toBe('Toy adaptation - Easy')
    expect(sectionSummary('parts', base())).toBe('1 part')
    expect(sectionSummary('parts', base({ parts: [{ is_optional: false, price_cents: 5800 }] as never }))).toBe('1 part, $58.00 total')
    expect(
      sectionSummary('tools', base({ tools: [{ name: 'a' }, { name: 'b' }] as never }))
    ).toBe('2 tools')
    expect(sectionSummary('files', base())).toBe('PDF and photo added')
  })

  // 128: Who it's for counts every tag answer; one_hand is one answer.
  it('counts the tag answers on Who it’s for, and invites when there are none', () => {
    expect(sectionSummary('suits', base())).toBe('Optional - helps families find it')
    const tagged = base({ device_types: ['switch'], helps_with: ['moving', 'calm'], access: ['press'], one_hand: true, press_force: ['light'], play: ['sound'] } as never)
    expect(sectionSummary('suits', tagged)).toBe('7 answers')
  })

  // 080: optional, so the empty line is an invitation rather than a gap.
  it('counts steps, and says nothing is there yet without calling it missing', () => {
    expect(sectionSummary('steps', base())).toBe('0 steps - nothing yet')
    expect(sectionSummary('steps', base({ steps: [{ id: 's' }, { id: 't' }] as never }))).toBe('2 steps')
    expect(getMissingFields(base()).some((g) => g.section === 'steps')).toBe(false)
  })
})

describe('SECTION_LABEL', () => {
  it('labels every section', () => {
    expect(SECTION_LABEL).toEqual({
      details: 'Details',
      steps: 'Steps',
      safety: 'Safety',
      suits: "Who it's for",
      parts: 'Parts',
      tools: 'Tools',
      files: 'Files',
      stl: '3D print files',
    })
  })
})

describe('sectionProgress', () => {
  it('counts the sections with nothing missing, out of the sections this kind shows', () => {
    const t = { title: 'T', difficulty: 'easy', build_minutes: 30, tutorial_pdf_url: 'x', photo_urls: ['p'], parts: [{}], tools: [], stl_files: [], kind: 'toy_adaptation', safety_declared_at: null } as never
    expect(sectionProgress(t)).toEqual({ ready: 4, total: 6 })
  })
})
