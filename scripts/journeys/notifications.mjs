#!/usr/bin/env node
// Notification types and server-side counts, each demanded a test. Fails on a type with no
// creator (dead), no asserting integration test, or a stale `notifies` reference; fails on a
// listed count with no action-then-change test. See docs/testing/journey-coverage-rule.md.
import { readFileSync, globSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { LAYERS, fileClaims } from './lib.mjs'

// Counts the API computes, keyed by the route that serves them. A test title carries `counts:<name>`.
export const COUNTS = [
  ...['tutorials', 'exchanges', 'challenges', 'organisations'].map((b) => ({ name: `unread-counts.${b}`, file: 'notifications.ts', needle: '/me/unread-counts' })),
  ...['tutorials', 'challenges', 'makers', 'printRequests', 'printJobs', 'review', 'intake', 'orgOrders'].map((f) => ({ name: `me-counts.${f}`, file: 'me.ts', needle: '/counts' })),
  ...['tutorials', 'reports', 'ideas', 'spotCheck', 'accounts', 'organisations'].map((f) => ({ name: `admin-counts.${f}`, file: 'admin.ts', needle: '/counts' })),
  { name: 'action-count', file: 'toy-transactions.ts', needle: '/action-count' },
  { name: 'saves.save_count', file: 'public.ts', needle: 'save_count' },
  { name: 'challenge.maker_count', file: 'toy-ideas.ts', needle: 'maker_count' },
  { name: 'challenge.answer_count', file: 'toy-ideas.ts', needle: 'answer_count' },
  { name: 'printers.open_jobs', file: 'printers.ts', needle: 'open_jobs' },
]

// A type with no creator is a deletion candidate; list it here with a dated reason instead of inventing one.
export const DEAD_ALLOWED = {}

export function parseUnion(source) {
  const file = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true)
  const types = []
  file.forEachChild((n) => {
    if (ts.isTypeAliasDeclaration(n) && n.name.text === 'NotificationType' && ts.isUnionTypeNode(n.type)) {
      for (const t of n.type.types) if (ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)) types.push(t.literal.text)
    }
  })
  return types
}

// it()/test() titles only: a describe title names a group, not an assertion.
export function testTitles(text) {
  const file = ts.createSourceFile('t.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const titles = []
  const visit = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && ['it', 'test'].includes(n.expression.text)) {
      const a = n.arguments[0]
      if (a && (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a))) titles.push(a.text)
    }
    ts.forEachChild(n, visit)
  }
  visit(file)
  return titles
}

const word = (name) => new RegExp(`(?<![\\w.-])${name.replace(/\./g, '\\.')}(?![\\w.-])`)
const quoted = (type) => new RegExp(`['"\`]${type}['"\`]`)
// Every migration re-lists the whole CHECK constraint, so mentions inside it (and inside a
// "not in" guard) are not creators; only a literal in a file that inserts notifications is.
const stripLists = (sql) => sql.replace(/check\s*\(\s*type\s+in\s*\([^)]*\)\s*\)/gi, '').replace(/not\s+in\s*\([^)]*\)/gi, '')
const insertsNotifications = /insert\s+into\s+(public\.)?notifications\b/i

export function creators(type, srcFiles, migrationFiles) {
  const hits = Object.keys(srcFiles).filter((f) => quoted(type).test(srcFiles[f]))
  for (const [f, sql] of Object.entries(migrationFiles)) {
    const body = stripLists(sql)
    if (insertsNotifications.test(body) && quoted(type).test(body.replaceAll("'", '"'))) hits.push(f)
  }
  return hits
}

// sources: { unionSource, srcFiles, migrationFiles, testFiles: {path: text}, rows }
export function buildMatrix({ unionSource, srcFiles, migrationFiles, testFiles, rows, e2eFiles = { web: {}, mobile: {} } }) {
  const errors = []
  const union = parseUnion(unionSource)
  if (!union.length) errors.push('parsed 0 notification types from NotificationType: the source shape changed')
  const titles = Object.entries(testFiles).map(([file, text]) => ({ file, titles: testTitles(text) }))
  const assertedBy = (re) => titles.filter((t) => t.titles.some((x) => re.test(x))).map((t) => t.file)

  const types = union.map((type) => {
    const by = creators(type, srcFiles, migrationFiles)
    const tests = assertedBy(word(type))
    if (!by.length && !(type in DEAD_ALLOWED)) errors.push(`dead type: ${type} has no creator in packages/api/src or supabase/migrations`)
    if (!tests.length) errors.push(`unasserted type: ${type} has no integration test titled with it`)
    const ids = rows.filter((r) => r.notifies?.includes(type)).map((r) => r.id)
    const specs = (platform) => Object.entries(e2eFiles[platform]).filter(([, fileIds]) => fileIds.some((id) => ids.includes(id))).map(([f]) => f)
    return { type, createdBy: by, assertedBy: tests, web: specs('web'), mobile: specs('mobile') }
  })
  for (const r of rows) {
    for (const n of r.notifies ?? []) {
      if (/^[a-z]+(_[a-z0-9]+)+$/.test(n) && !union.includes(n)) errors.push(`stale reference: ${r.id} notifies "${n}", which is not in NotificationType`)
    }
  }
  const counts = COUNTS.map((c) => {
    const tests = assertedBy(word(`counts:${c.name}`))
    const handler = Object.entries(srcFiles).find(([f]) => f.endsWith(`/routes/${c.file}`))?.[1] ?? ''
    if (!handler.includes(c.needle)) errors.push(`stale count: ${c.name} expects "${c.needle}" in routes/${c.file}`)
    if (!tests.length) errors.push(`unasserted count: ${c.name} has no integration test titled counts:${c.name}`)
    return { ...c, assertedBy: tests }
  })
  return { types, counts, errors }
}

export function loadSources(root) {
  const read = (f) => readFileSync(resolve(root, f), 'utf8')
  const files = (pattern) => Object.fromEntries(globSync(pattern, { cwd: root }).sort().map((f) => [f, read(f)]))
  const legacy = new Set(JSON.parse(read('scripts/journeys/legacy-file-tags.json')))
  const e2e = (layer) => {
    const out = {}
    for (const f of globSync(LAYERS[layer].glob, { cwd: root }).sort()) {
      const ids = fileClaims(f, read(f), legacy).ids
      if (ids.length) out[f] = ids
    }
    return out
  }
  return {
    unionSource: read('packages/types/src/index.ts'),
    srcFiles: files('packages/api/src/**/*.ts'),
    migrationFiles: files('supabase/migrations/*.sql'),
    testFiles: files(LAYERS.api.glob),
    rows: JSON.parse(read('scripts/journeys/journeys.json')),
    e2eFiles: { web: e2e('web-e2e'), mobile: e2e('mobile-e2e') },
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
  const { types, counts, errors } = buildMatrix(loadSources(root))
  for (const e of errors) console.error(e)
  const bad = (list) => list.filter((x) => !x.assertedBy.length).length
  console.log(`${types.length} notification types, ${bad(types)} unasserted; ${counts.length} counts, ${bad(counts)} unasserted`)
  process.exit(errors.length ? 1 : 0)
}
