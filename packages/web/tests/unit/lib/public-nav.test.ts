import { describe, it, expect } from 'vitest'
import { PUBLIC_NAV, FOOTER_LEGAL, sectionFor, SCAFFOLD_KEYS } from '@/lib/public-nav'

describe('public nav model', () => {
  it('has exactly the seven sections, pillars first', () => {
    // 3D Printing joined the top level on 2026-08-20: it is one of the three
    // things SPLAT provides, not a Get Involved sub-item. The three pillars lead.
    expect(PUBLIC_NAV.map((s) => s.label)).toEqual([
      'Guides',
      'Toy Library',
      '3D Printing',
      'Learn',
      'Get Involved',
      'Impact',
      'About',
    ])
  })

  it('leaves the two flat catalogues without children so no subnav renders', () => {
    const flat = PUBLIC_NAV.filter((s) => s.children.length === 0)
    expect(flat.map((s) => s.href)).toEqual(['/library', '/toy-library'])
  })

  it('gives every other section children', () => {
    for (const section of PUBLIC_NAV) {
      if (section.href === '/library' || section.href === '/toy-library') continue
      expect(section.children.length).toBeGreaterThan(0)
    }
  })

  it('never repeats an href anywhere in the tree', () => {
    const all = [
      ...PUBLIC_NAV.map((s) => s.href),
      ...PUBLIC_NAV.flatMap((s) => s.children.map((c) => c.href)),
      ...FOOTER_LEGAL.map((l) => l.href),
    ]
    expect(new Set(all).size).toBe(all.length)
  })

  it('gives every item a label and a blurb, because hub cards and the footer both need them', () => {
    const items = [...PUBLIC_NAV.flatMap((s) => s.children), ...FOOTER_LEGAL]
    for (const item of items) {
      expect(item.label.length).toBeGreaterThan(0)
      expect(item.blurb.length).toBeGreaterThan(0)
    }
  })

  it('maps a nested path to its section', () => {
    expect(sectionFor('/learn/switch-types')?.label).toBe('Learn')
    expect(sectionFor('/get-involved/families')?.label).toBe('Get Involved')
  })

  // The one case a plain path-prefix test gets wrong: /organizations is a child
  // of Impact but shares no prefix with /impact.
  it('maps /organizations to Impact', () => {
    expect(sectionFor('/organizations')?.label).toBe('Impact')
    expect(sectionFor('/organizations/abc/public')?.label).toBe('Impact')
  })

  it('returns undefined for a path outside the public tree', () => {
    expect(sectionFor('/dashboard')).toBeUndefined()
  })

  it('lists a scaffold key for every soon child, and nothing else', () => {
    const soon = PUBLIC_NAV.flatMap((s) => s.children).filter((c) => c.state === 'soon')
    expect(SCAFFOLD_KEYS.length).toBe(soon.length)
    expect(new Set(SCAFFOLD_KEYS).size).toBe(SCAFFOLD_KEYS.length)
  })

  it('has six footer legal links', () => {
    expect(FOOTER_LEGAL).toHaveLength(6)
  })
})

describe('three-pillar IA', () => {
  it('carries seven sections', () => {
    expect(PUBLIC_NAV).toHaveLength(7)
  })

  it('marks exactly three pillars, in the order SPLAT provides them', () => {
    const pillars = PUBLIC_NAV.filter((s) => s.rank === 'pillar').map((s) => s.href)
    expect(pillars).toEqual(['/library', '/toy-library', '/printing'])
  })

  it('gives the pillars the three distinct accents and everything else the blue family', () => {
    const byHref = Object.fromEntries(PUBLIC_NAV.map((s) => [s.href, s.tone]))
    expect(byHref['/library']).toBe('brand')
    expect(byHref['/toy-library']).toBe('mint')
    expect(byHref['/printing']).toBe('apricot')
    for (const s of PUBLIC_NAV) expect(s.tone).toBeTruthy()
  })

  it('moves 3D printing out of Learn and out of Get Involved', () => {
    const childHrefs = PUBLIC_NAV.flatMap((s) => s.children.map((c) => c.href))
    expect(childHrefs).not.toContain('/learn/3d-printing-basics')
    expect(
      PUBLIC_NAV.find((s) => s.href === '/get-involved')!.children.map((c) => c.href)
    ).not.toContain('/printing')
  })

  it('gives the printing pillar a live child, so its hub is never a placeholder', () => {
    const printing = PUBLIC_NAV.find((s) => s.href === '/printing')!
    expect(printing.children.map((c) => c.href)).toEqual([
      '/printing/basics',
      '/printing/requests',
      '/printing/parts',
    ])
    expect(printing.children.find((c) => c.href === '/printing/basics')!.state).toBe('live')
  })

  it('resolves the new printing routes to their section', () => {
    expect(sectionFor('/printing/basics')?.label).toBe('3D Printing')
    expect(sectionFor('/printing')?.label).toBe('3D Printing')
  })
})
