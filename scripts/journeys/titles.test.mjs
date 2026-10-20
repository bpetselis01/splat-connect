import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTitles, yamlName } from './titles.mjs'

const ts = (src) => parseTitles(src, 'ts')
const yaml = (src) => parseTitles(src, 'yaml')

test('a test, it.each (inline and table), test.only, JSX and an @tag prefix each yield their ids', () => {
  assert.deepEqual(ts("test('WD03 accepts', async () => {})"), { ids: ['WD03'], errors: [] })
  assert.deepEqual(ts("it.each(rows)('G09 %s', (r) => {})").ids, ['G09'])
  assert.deepEqual(ts("it.each([\n  ['a', 1],\n  ['b', 2],\n])('G09 %s', (r) => {})").ids, ['G09'])
  assert.deepEqual(ts('it.each`\n a | b\n ${1} | ${2}\n`(\'G09 %s\', () => {})').ids, ['G09'])
  assert.deepEqual(ts("test.only('G10 focus', () => {})").ids, ['G10'])
  assert.deepEqual(ts("it('G09 renders', () => { render(<Screen id=\"X01\" />) })").ids, ['G09'])
  assert.deepEqual(ts("test('@responsive WD03 narrow', () => {})").ids, ['WD03'])
  assert.deepEqual(ts("test(`G11 plain template`, () => {})").ids, ['G11'])
  assert.deepEqual(ts("it('G09 G10 thank and note', () => {})"), { ids: ['G09', 'G10'], errors: [] })
})

test('titles with no leading id yield nothing and no error', () => {
  for (const title of ['A11y labels', 'G091 too long', 'g09 lower case', 'thank G09 late']) {
    assert.deepEqual(ts(`test('${title}', () => {})`), { ids: [], errors: [] }, title)
  }
})

test('skip, fixme, todo, describe, comments and strings contribute nothing', () => {
  const src = [
    "test.skip('G01 skipped', () => {})",
    "test.fixme('G02 fixme', () => {})",
    "it.todo('G03 todo')",
    "test.describe('G04 group', () => {})",
    "describe('G05 group', () => {})",
    "it.skip.each(rows)('G06 %s', () => {})",
    "// test('G07 commented out', () => {})",
    "const fixture = \"test('G08 in a string', () => {})\"",
  ].join('\n')
  assert.deepEqual(ts(src), { ids: [], errors: [] })
})

test('a dynamic id and a duplicate id in one title are errors', () => {
  assert.deepEqual(ts('test(`${id} works`, () => {})'), { ids: [], errors: ['dynamic id in title "`${id} works`"'] })
  assert.deepEqual(ts('test(`G09 ${name}`, () => {})').errors.length, 1)
  assert.deepEqual(ts("test(`plain ${name}`, () => {})"), { ids: [], errors: [] })
  assert.deepEqual(ts("test('G09 G09 twice', () => {})"), { ids: ['G09'], errors: ['duplicate id G09 in title "G09 G09 twice"'] })
})

test('yaml reads only a top-level name: above the first ---', () => {
  assert.deepEqual(yaml('appId: x\nname: "A14 A05 cold start"\n---\n- launchApp'), { ids: ['A14', 'A05'], errors: [] })
  assert.deepEqual(yaml("name: 'B01 single quoted'\n---\n"), { ids: ['B01'], errors: [] })
  assert.deepEqual(yaml('name: G05 bare\n'), { ids: ['G05'], errors: [] })
  assert.deepEqual(yaml('appId: x\n---\n- runFlow:\n    name: "A14 in a step"\n'), { ids: [], errors: [] })
  assert.deepEqual(yaml('- tapOn:\n    name: "A14 indented"\n'), { ids: [], errors: [] })
  assert.equal(yamlName('appId: x\n---\n- launchApp'), undefined)
  assert.equal(yamlName('name: A14 x'), 'A14 x')
})

test('an id may carry a trailing colon or comma, as the repo writes titles', () => {
  assert.deepEqual(ts("test('Q10: opens the thread', () => {})"), { ids: ['Q10'], errors: [] })
  assert.deepEqual(ts("test('P10, L29 each message', () => {})"), { ids: ['P10', 'L29'], errors: [] })
  assert.deepEqual(ts("test('P10 and L29 each message', () => {})"), { ids: ['P10'], errors: [] })
})
