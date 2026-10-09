import { reviewLead, reviewRows } from '../../../lib/review-checklist'
import { getMissingFields, nextIncompleteSection, sectionProgress, sectionSummary, sectionsFor } from '../../../lib/tutorial-sections'
import type { TutorialWithDetails } from '@splat-connect/types'

const draft = (over: Partial<TutorialWithDetails> = {}): TutorialWithDetails =>
  ({
    id: 't1', title: 'A guide', description: 'Why it matters', kind: 'toy_adaptation', difficulty: 'easy', status: 'draft',
    safety_declared_at: '2026-09-02T00:00:00Z', build_minutes: 30, tutorial_pdf_url: 'p.pdf', photo_urls: ['p.jpg'],
    parts: [{ name: 'Switch', price_cents: 500, is_optional: false }], tools: [{ name: 'Screwdriver', is_optional: false }],
    stl_files: [], steps: [], safety_notes: [], ...over,
  }) as unknown as TutorialWithDetails

const row = (t: TutorialWithDetails, title: string) => reviewRows(t).find((r) => r.title === title)!

describe('review checklist edges', () => {
  it('flags a whitespace-only summary as missing', () => {
    expect(row(draft({ description: '   \n ' }), 'Summary')).toEqual({ title: 'Summary', meta: 'No summary yet', ok: false })
  })

  it('says No steps or PDF yet and flags a guide with neither, and treats missing steps as none', () => {
    expect(row(draft({ steps: [], tutorial_pdf_url: null }), 'Guide content')).toEqual({ title: 'Guide content', meta: 'No steps or PDF yet', ok: false })
    expect(row(draft({ steps: undefined, tutorial_pdf_url: null }), 'Guide content').ok).toBe(false)
  })

  it('counts a 120-step guide with some bare steps', () => {
    const steps = Array.from({ length: 120 }, (_, i) => ({ photo_url: i < 100 ? 'p' : null }))
    expect(row(draft({ steps: steps as never, tutorial_pdf_url: null }), 'Guide content')).toEqual({ title: 'Guide content', meta: '120 steps, 20 without a photo', ok: false })
  })

  it('uses the singular for one step, one part and one tool', () => {
    const t = draft({ steps: [{ photo_url: 'p' }] as never })
    expect(row(t, 'Guide content').meta).toBe('1 step, all photographed')
    expect(row(t, 'Parts').meta).toBe('1 part with prices')
    expect(row(t, 'Tools').meta).toBe('1 tool')
  })

  it('flags no parts and no tools', () => {
    const t = draft({ parts: [], tools: [] })
    expect(row(t, 'Parts')).toEqual({ title: 'Parts', meta: 'No parts listed', ok: false })
    expect(row(t, 'Tools')).toEqual({ title: 'Tools', meta: 'No tools listed', ok: false })
  })

  it('counts the parts that lack a price while still passing the section', () => {
    const t = draft({ parts: [{ price_cents: 100 }, { price_cents: null }, { price_cents: null }] as never })
    expect(row(t, 'Parts')).toEqual({ title: 'Parts', meta: '3 parts, 2 without a price', ok: true })
  })

  it('says the tools are all optional only when every one is', () => {
    expect(row(draft({ tools: [{ is_optional: true }, { is_optional: false }] as never }), 'Tools').meta).toBe('2 tools')
    expect(row(draft({ tools: [{ is_optional: true }, { is_optional: true }] as never }), 'Tools').meta).toBe('2 optional tools')
  })

  it('flags an unaffirmed safety checklist and capitalises the line', () => {
    expect(row(draft({ safety_declared_at: null }), 'Safety notes')).toEqual({ title: 'Safety notes', meta: 'Checklist not affirmed', ok: false })
    expect(row(draft({ safety_declared_at: null, safety_notes: [{ title: 'x' }] as never }), 'Safety notes').meta).toBe('1 note · checklist not affirmed')
  })

  it('needs an STL for assistive tech, and no longer needs the PDF', () => {
    expect(row(draft({ tutorial_pdf_url: null }), 'Files')).toEqual({ title: 'Files', meta: 'no PDF · none needed to print', ok: true })
    expect(row(draft({ kind: 'assistive_tech', stl_files: [{}] as never }), 'Files')).toEqual({ title: 'Files', meta: 'PDF · 1 STL file', ok: true })
    expect(row(draft({ kind: 'assistive_tech', stl_files: [{}, {}] as never }), 'Files').meta).toBe('PDF · 2 STL files')
    expect(row(draft({ kind: 'assistive_tech', stl_files: [] }), 'Files').ok).toBe(false)
  })

  it('leads with 6 of 6 for a finished guide and 1 for a bare one (Files needs nothing)', () => {
    const full = draft({ steps: [{ photo_url: 'p' }] as never })
    expect(reviewLead(reviewRows(full))).toBe('6 sections, 6 complete.')
    const bare = draft({ description: null, steps: [], parts: [], tools: [], safety_declared_at: null, tutorial_pdf_url: null })
    expect(reviewLead(reviewRows(bare))).toBe('6 sections, 1 complete.')
  })

  it('never throws on emoji or very long summaries', () => {
    expect(row(draft({ description: `🧸${'x'.repeat(10000)}` }), 'Summary').ok).toBe(true)
  })
})

describe('getMissingFields edges', () => {
  it('reports a title of only spaces, tabs and newlines', () => {
    expect(getMissingFields(draft({ title: ' \t\n ' }))).toEqual([{ section: 'details', label: 'A title' }])
  })

  it('accepts a very long and an emoji title', () => {
    expect(getMissingFields(draft({ title: '🧸'.repeat(400) }))).toEqual([])
  })

  it('treats a whitespace-only PDF path as no PDF', () => {
    expect(getMissingFields(draft({ tutorial_pdf_url: '   ' }))).toEqual([{ section: 'steps', label: 'Steps or a guide PDF' }])
  })

  it('accepts each of the three difficulties and nothing else', () => {
    for (const d of ['easy', 'medium', 'hard']) expect(getMissingFields(draft({ difficulty: d as never }))).toEqual([])
    for (const d of ['', 'EASY', null, undefined]) expect(getMissingFields(draft({ difficulty: d as never }))).toEqual([{ section: 'details', label: 'A difficulty' }])
  })

  it('does not require steps, a summary or a priced part to submit', () => {
    expect(getMissingFields(draft({ steps: [], description: null, parts: [{ name: 'x', price_cents: null }] as never }))).toEqual([])
  })

  it('lists the STL gap last for an assistive tech guide that is otherwise bare', () => {
    const gaps = getMissingFields(draft({ kind: 'assistive_tech', safety_declared_at: null }))
    expect(gaps.map((g) => g.section)).toEqual(['stl', 'safety'])
  })
})

describe('nextIncompleteSection', () => {
  it('walks a fresh draft section by section', () => {
    const t = draft({ title: '', difficulty: null as never, build_minutes: null, tutorial_pdf_url: null, photo_urls: [], parts: [], tools: [], safety_declared_at: null })
    expect(nextIncompleteSection('details', t)).toBe('photos')
    expect(nextIncompleteSection('photos', t)).toBe('steps')
    expect(nextIncompleteSection('steps', t)).toBe('parts')
    expect(nextIncompleteSection('parts', t)).toBe('tools')
    expect(nextIncompleteSection('tools', t)).toBe('safety')
    expect(nextIncompleteSection('safety', t)).toBe('details')
  })

  it('wraps past the end back to an earlier gap', () => {
    expect(nextIncompleteSection('files', draft({ parts: [] }))).toBe('parts')
  })

  it('is null when the only gap is the section you are on, and when there are none', () => {
    expect(nextIncompleteSection('parts', draft({ parts: [] }))).toBeNull()
    expect(nextIncompleteSection('details', draft())).toBeNull()
  })

  it('never offers steps, which no gap names', () => {
    expect(nextIncompleteSection('safety', draft({ steps: [], parts: [] }))).toBe('parts')
    expect(nextIncompleteSection('details', draft())).not.toBe('steps')
  })

  it('does not offer stl to a toy adaptation, but does to assistive tech', () => {
    expect(nextIncompleteSection('files', draft({ kind: 'toy_adaptation', stl_files: [] }))).toBeNull()
    expect(nextIncompleteSection('files', draft({ kind: 'assistive_tech', stl_files: [] }))).toBe('stl')
  })
})

describe('sectionSummary and progress edges', () => {
  it('says "No difficulty" for an unknown difficulty and appends the missing build time', () => {
    expect(sectionSummary('details', draft({ difficulty: 'x' as never, build_minutes: null }))).toBe('Toy adaptation - No difficulty - no build time yet')
  })

  it('pluralises one step, one part, one tool and one STL', () => {
    expect(sectionSummary('steps', draft({ steps: [{}] as never }))).toBe('1 step')
    expect(sectionSummary('tools', draft())).toBe('1 tool')
    expect(sectionSummary('stl', draft({ kind: 'assistive_tech', stl_files: [{}] as never }))).toBe('1 file')
  })

  it('totals only when every part has a price', () => {
    const priced = draft({ parts: [{ price_cents: 1250 }, { price_cents: 50 }] as never })
    expect(sectionSummary('parts', priced)).toBe('2 parts, $13.00 total')
    const mixed = draft({ parts: [{ price_cents: 1250 }, { price_cents: null }] as never })
    expect(sectionSummary('parts', mixed)).toBe('2 parts')
  })

  it('calls the guide PDF optional when it is the only thing not there', () => {
    expect(sectionSummary('files', draft({ tutorial_pdf_url: null, steps: [] }))).toBe('Optional - or write the steps instead')
  })

  it('counts 7 of 7 for a finished assistive tech guide and 6 of 7 without its STL', () => {
    expect(sectionProgress(draft({ kind: 'assistive_tech', stl_files: [{}] as never }))).toEqual({ ready: 7, total: 7 })
    expect(sectionProgress(draft({ kind: 'assistive_tech' }))).toEqual({ ready: 6, total: 7 })
  })

  it('counts steps as always ready since no gap names them', () => {
    expect(sectionsFor('toy_adaptation')).toContain('steps')
    expect(sectionProgress(draft({ steps: [] })).ready).toBe(6)
  })
})
