import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTags, coverage, renderDoc } from './lib.mjs'

const J = [
  { id: 'G23', required: ['mobile-unit', 'mobile-e2e', 'api'], seat: 'P', screen: 's', element: 'e', api: ['POST /x'], db: [], notifies: [], counts: [], setter: 'n/a' },
  { id: 'B05', required: ['mobile-unit', 'device'], seat: 'P', screen: 's', element: 'e', api: [], db: [], notifies: [], counts: [], setter: 'n/a', waived: { device: 'simulator only' } },
]

test('parseTags reads one tag line within the first 10 lines', () => {
  assert.deepEqual(parseTags('// header\n// journeys: G23 B05\nimport x'), { ids: ['G23', 'B05'], errors: [] })
  assert.deepEqual(parseTags('# journeys: B05\nappId: x'), { ids: ['B05'], errors: [] })
  assert.deepEqual(parseTags('no tag here'), { ids: [], errors: [] })
})

test('parseTags rejects a second tag line, lowercase and duplicate ids', () => {
  assert.equal(parseTags('// journeys: G23\n// journeys: B05').errors.length, 1)
  assert.equal(parseTags('// journeys: g23').errors.length, 1)
  assert.equal(parseTags('// journeys: G23 G23').errors.length, 1)
})

test('coverage lists a gap per missing required layer, honours waivers, names unknown tags', () => {
  const files = { 'mobile-unit': { 'u.test.ts': ['G23', 'B05'] }, 'mobile-e2e': {}, api: { 'a.test.ts': ['G23', 'Z99'] }, device: {} }
  const c = coverage(J, files)
  assert.deepEqual(c.gaps, [{ id: 'G23', layer: 'mobile-e2e' }])
  assert.deepEqual(c.unknown, [{ file: 'a.test.ts', id: 'Z99' }])
  assert.deepEqual(c.waived, [{ id: 'B05', layer: 'device', reason: 'simulator only' }])
})

test('a device-only gap is reported even when unit is green', () => {
  const c = coverage([{ ...J[1], waived: undefined }], { 'mobile-unit': { 'u.test.ts': ['B05'] }, 'mobile-e2e': {}, api: {}, device: {} })
  assert.deepEqual(c.gaps, [{ id: 'B05', layer: 'device' }])
})

test('renderDoc is deterministic and sorted by id', () => {
  const c = coverage(J, { 'mobile-unit': { 'u.test.ts': ['G23', 'B05'] }, 'mobile-e2e': {}, api: { 'a.test.ts': ['G23'] }, device: {} })
  const a = renderDoc(J, c), b = renderDoc([...J].reverse(), c)
  assert.equal(a, b)
  assert.match(a, /\| B05 \|/)
  assert.ok(a.indexOf('| B05 |') < a.indexOf('| G23 |'))
  assert.ok(!a.includes('\r'))
})
