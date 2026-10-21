import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseUnion, buildMatrix, COUNTS } from './notifications.mjs'

const union = `export type Other = 'x'\nexport type NotificationType =\n  | 'toy_request'\n  | 'challenge_guide_published'\n  | 'toy_message'\n`
const countTests = COUNTS.map((c) => `it('counts:${c.name} moves', () => {})`).join('\n')
const handlers = Object.fromEntries([...new Set(COUNTS.map((c) => c.file))].map((f) => [`packages/api/src/routes/${f}`, COUNTS.filter((c) => c.file === f).map((c) => c.needle).join(' ')]))
const base = () => ({
  unionSource: union,
  srcFiles: { ...handlers, 'packages/api/src/routes/toy-transactions.ts': `${handlers['packages/api/src/routes/toy-transactions.ts']} type: 'toy_request', type: 'toy_message'` },
  migrationFiles: {
    // the CHECK list mentions every type; only the function body creates one
    '109.sql': `alter table notifications add constraint c check (type in ('toy_request', 'challenge_guide_published'));
      create function f() returns trigger as $$ begin insert into public.notifications (type) values ('challenge_guide_published'); end $$;`,
  },
  testFiles: { 'a.test.ts': `describe('x', () => { it('toy_request is written', () => {}); it('toy_message is written', () => {}); it('challenge_guide_published fires', () => {}) })\n${countTests}` },
  rows: [{ id: 'WD01', notifies: ['toy_request', 'OTP mail'] }],
})

test('the parser returns the union members and only those', () => {
  assert.deepEqual(parseUnion(union), ['toy_request', 'challenge_guide_published', 'toy_message'])
})

test('a happy tree passes, and a trigger-created type is found through the migrations', () => {
  const m = buildMatrix(base())
  assert.deepEqual(m.errors, [])
  assert.deepEqual(m.types.find((t) => t.type === 'challenge_guide_published').createdBy, ['109.sql'])
})

test('a parser that finds 0 types fails loudly', () => {
  assert.match(buildMatrix({ ...base(), unionSource: 'export type NotificationType = string' }).errors[0], /parsed 0 notification types/)
})

test('a type mentioned only in a CHECK list has no creator', () => {
  const s = base()
  s.migrationFiles = { '109.sql': `check (type in ('toy_request', 'challenge_guide_published'))` }
  const dead = buildMatrix(s).errors.filter((e) => e.startsWith('dead type'))
  assert.deepEqual(dead, ['dead type: challenge_guide_published has no creator in packages/api/src or supabase/migrations'])
})

test('a type added to the union without a test fails', () => {
  const s = base()
  s.unionSource = union + "  | 'org_thanked'\n"
  s.srcFiles['packages/api/src/routes/organizations.ts'] = "type: 'org_thanked'"
  assert.deepEqual(buildMatrix(s).errors, ['unasserted type: org_thanked has no integration test titled with it'])
})

test('a describe title does not assert a type', () => {
  const s = base()
  s.testFiles = { 'a.test.ts': `describe('toy_message', () => { it('works', () => {}) })` }
  assert.ok(buildMatrix(s).errors.includes('unasserted type: toy_message has no integration test titled with it'))
})

test('a row that notifies a type no longer in the union is a stale reference', () => {
  const s = base()
  s.rows = [{ id: 'WD09', notifies: ['toy_gone'] }]
  assert.deepEqual(buildMatrix(s).errors, ['stale reference: WD09 notifies "toy_gone", which is not in NotificationType'])
})

test('a count without its test fails', () => {
  const s = base()
  s.testFiles['a.test.ts'] = s.testFiles['a.test.ts'].replace('counts:admin-counts.reports', 'counts:admin-counts.reportsX')
  assert.deepEqual(buildMatrix(s).errors, ['unasserted count: admin-counts.reports has no integration test titled counts:admin-counts.reports'])
})
