import { describe, it, expect } from 'vitest'
import { PUBLIC_NAV, FOOTER_LEGAL, sectionFor, SCAFFOLD_KEYS } from '@/lib/public-nav'

describe('public nav model', () => {
  it('has exactly the six sections, in order', () => {
    expect(PUBLIC_NAV.map((s) => s.label)).toEqual([
      'Guides',
      'Toy Library',
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
