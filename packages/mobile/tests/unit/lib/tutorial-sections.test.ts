import {
  getMissingFields,
  sectionChecks,
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
      { section: 'steps', label: 'Steps or a guide PDF' },
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
  it('gives a toy adaptation eight sections and no STL', () => {
    expect(sectionsFor('toy_adaptation')).toEqual(['details', 'steps', 'parts', 'tools', 'safety', 'suits', 'picks', 'files'])
  })

  it('adds STL for assistive tech', () => {
    expect(sectionsFor('assistive_tech')).toEqual([
      'details',
      'steps',
      'parts',
      'tools',
      'safety',
      'suits',
      'picks',
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

  it('counts the picks, and an empty picks row is an invitation not a gap', () => {
    expect(sectionSummary('picks', base())).toBe('Optional - up to three guides to read next')
    expect(sectionSummary('picks', base({ tutorial_recommendations: [{}, {}] } as never))).toBe('2 guides')
    expect(getMissingFields(base()).some((g) => g.section === 'picks')).toBe(false)
  })

  // A PDF alone satisfies the rule, so base() (which has one) is not a gap.
  it('counts steps, and a PDF alone is not a gap', () => {
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
      picks: 'Worth a look',
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

describe('sectionChecks', () => {
  it('lists every requirement with its done state, in the order getMissingFields reports them', () => {
    const t = base({ title: '', build_minutes: null })
    const checks = sectionChecks(t)
    const missingLabels = checks.filter((c) => !c.done).map((c) => c.label)
    expect(getMissingFields(t).map((g) => g.label)).toEqual(missingLabels)
    expect(checks.every((c) => typeof c.section === 'string')).toBe(true)
  })

  it('marks a satisfied requirement done instead of dropping it', () => {
    const t = base({ title: 'Drum' })
    expect(sectionChecks(t).find((c) => c.label === 'A title')?.done).toBe(true)
  })
})

const step = () => ({ id: 's1', position: 1, title: 'Cut', body: 'Cut it', photo_url: null, tip: null, minutes: null }) as never

describe('steps or a guide PDF', () => {
  const gap = (t: TutorialWithDetails) => getMissingFields(t).find((g) => g.label === 'Steps or a guide PDF')

  it('is a gap, on the Steps section, when there are neither', () => {
    expect(gap(base({ steps: [], tutorial_pdf_url: null }))?.section).toBe('steps')
  })
  it('is satisfied by a PDF alone', () => {
    expect(gap(base({ steps: [], tutorial_pdf_url: 'a/b.pdf' }))).toBeUndefined()
  })
  it('is satisfied by steps alone', () => {
    expect(gap(base({ steps: [step()], tutorial_pdf_url: null }))).toBeUndefined()
  })
  it('is satisfied by both', () => {
    expect(gap(base({ steps: [step()], tutorial_pdf_url: 'a/b.pdf' }))).toBeUndefined()
  })
  it('never asks for "The guide PDF" any more', () => {
    expect(getMissingFields(base({ steps: [], tutorial_pdf_url: null })).map((g) => g.label)).not.toContain('The guide PDF')
  })
  it('counts Steps as a section that can be incomplete in the progress total', () => {
    const { ready, total } = sectionProgress(base({ steps: [], tutorial_pdf_url: null }))
    expect(total - ready).toBeGreaterThanOrEqual(1)
  })
})

describe('sectionSummary for steps and files', () => {
  it('Steps says it is using the PDF when there are no steps and a PDF', () => {
    expect(sectionSummary('steps', base({ steps: [], tutorial_pdf_url: 'a.pdf' }))).toBe('Using your PDF')
  })
  it('Steps asks for steps or a PDF when there is neither', () => {
    expect(sectionSummary('steps', base({ steps: [], tutorial_pdf_url: null }))).toBe('Steps or PDF needed')
  })
  it('Files only asks for a photo when steps exist and there is no PDF', () => {
    expect(sectionSummary('files', base({ steps: [step()], tutorial_pdf_url: null, photo_urls: [] }))).toBe('A photo - PDF optional')
  })
  it('Files says PDF optional with steps, a photo and no PDF', () => {
    expect(sectionSummary('files', base({ steps: [step()], tutorial_pdf_url: null, photo_urls: ['p.jpg'] }))).toBe('Photo added - PDF optional')
  })
})
