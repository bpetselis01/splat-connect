// journeys: (none — this file checks the map itself)
import journeys from '../journeys.json'

const fs = require('fs') as { readFileSync(f: string, e: 'utf8'): string }
const path = require('path') as { join(...p: string[]): string }
declare const __dirname: string

const LAYERS = ['unit', 'e2e', 'api', 'device'] as const
const SEATS = ['P', 'L', 'A'] as const
const SETTERS = ['mobile', 'web', 'none', 'n/a'] as const

describe('journeys.json', () => {
  it('has unique uppercase ids in inventory order', () => {
    const ids = journeys.map((j) => j.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[A-Z]\d{2}$/)
  })

  it('covers every id the inventory names', () => {
    const full = fs.readFileSync(path.join(__dirname, '../../../../docs/testing/mobile-journeys-inventory-2026-10-07.md'), 'utf8')
    // only §2 holds journeys; later sections reuse S10+ for silent-gap findings
    const inv = full.slice(full.indexOf('# 2. Journeys'), full.indexOf('# 3. Existing tests'))
    const named = new Set([...inv.matchAll(/^\| ([A-Z]\d{2})(?:, ([A-Z]\d{2}))? \|/gm)].flatMap((m) => [m[1], m[2]].filter(Boolean)))
    const have = new Set(journeys.map((j) => j.id))
    expect([...named].filter((id) => !have.has(id))).toEqual([])
  })

  it('every row has a valid seat, setter and required layers', () => {
    for (const j of journeys) {
      expect(SEATS).toContain(j.seat)
      expect(SETTERS).toContain(j.setter)
      expect(j.required.length).toBeGreaterThan(0)
      for (const l of j.required) expect(LAYERS).toContain(l)
      expect(j.required).toContain('unit')
      if (j.api.length) expect(j.required).toContain('api')
      for (const key of ['api', 'db', 'notifies', 'counts'] as const) expect(Array.isArray(j[key])).toBe(true)
    }
  })

  it('names the new guide-page journeys', () => {
    expect(journeys.find((j) => j.id === 'G30')?.element).toMatch(/3D/)
  })
})
