import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTags, coverage, renderDoc, validateRows } from './lib.mjs'

const J = [
  { id: 'G23', platform: 'mobile', route: 'r', kind: 'write', device: false, required: ['mobile-unit', 'mobile-e2e', 'api'], seat: 'P', screen: 's', element: 'e', api: ['POST /x'], db: [], notifies: [], counts: [], setter: 'n/a' },
  { id: 'B05', platform: 'mobile', route: 'r', kind: 'nav', device: true, required: ['mobile-unit', 'device'], seat: 'P', screen: 's', element: 'e', api: [], db: [], notifies: [], counts: [], setter: 'n/a', waived: { device: 'simulator only' } },
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

test('coverage ignores a tag on a layer illegal for the row and reports it unknown with the file', () => {
  const files = { 'mobile-unit': { 'u.test.ts': ['B05'] }, 'web-e2e': { 'w.spec.ts': ['G23'] }, api: {}, device: {} }
  const c = coverage(J, files)
  assert.deepEqual(c.unknown, [{ file: 'w.spec.ts', id: 'G23' }])
  assert.equal(c.covered['web-e2e'].has('G23'), false)
})

const ok = J[0]
const errorsFor = (patch) => validateRows([{ ...ok, ...patch }])

test('validateRows accepts a fully valid row', () => {
  assert.deepEqual(validateRows([ok]), [])
})

test('validateRows names the id, rule and message for each broken field', () => {
  assert.deepEqual(errorsFor({ platform: undefined }), [{ id: 'G23', rule: 'platform', message: 'platform is missing' }])
  assert.deepEqual(errorsFor({ route: '' }), [{ id: 'G23', rule: 'route', message: 'route is missing' }])
  assert.deepEqual(errorsFor({ kind: undefined }), [{ id: 'G23', rule: 'kind', message: 'kind is missing' }])
  assert.deepEqual(errorsFor({ kind: 'read' }), [{ id: 'G23', rule: 'kind', message: 'unknown kind "read"' }])
  assert.deepEqual(errorsFor({ required: ['mobile-unit', 'mobile-smoke'] }), [{ id: 'G23', rule: 'layer-known', message: 'unknown layer "mobile-smoke"' }])
})

test('validateRows rejects a layer from the other platform', () => {
  assert.deepEqual(errorsFor({ required: ['web-e2e'] }), [{ id: 'G23', rule: 'layer-legal', message: 'layer "web-e2e" is not legal for platform "mobile"' }])
  assert.deepEqual(errorsFor({ platform: 'web', required: ['mobile-unit'] }), [{ id: 'G23', rule: 'layer-legal', message: 'layer "mobile-unit" is not legal for platform "web"' }])
})

test('validateRows rejects a duplicate id and a waiver for a layer that is not required', () => {
  assert.deepEqual(validateRows([ok, ok]), [{ id: 'G23', rule: 'duplicate-id', message: 'id appears more than once' }])
  assert.deepEqual(errorsFor({ waived: { device: 'no phone' } }), [{ id: 'G23', rule: 'waiver', message: 'waived layer "device" is not required' }])
})
