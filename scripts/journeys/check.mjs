#!/usr/bin/env node
// Fails when a row is invalid, a route has neither a row nor a reasoned opt-out (or an opt-out is stale), a journey's required layer has no tagged test, a tag names an
// unknown journey, a file carries a malformed tag or a file-level tag off the legacy list, or the rendered doc is
// stale. `--write` regenerates docs/testing/journeys.md instead.
import { readFileSync, writeFileSync, globSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LAYERS, fileClaims, legacyErrors, coverage, renderDoc, validateRows, routesFromFiles, routeTripwire, apiPathsExist } from './lib.mjs'
import { yamlName } from './titles.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const journeys = JSON.parse(readFileSync(resolve(root, 'scripts/journeys/journeys.json'), 'utf8'))
const invalid = validateRows(journeys)
if (invalid.length) {
  for (const e of invalid) console.error(`${e.id}: ${e.rule}: ${e.message}`)
  process.exit(1)
}
const optOuts = JSON.parse(readFileSync(resolve(root, 'scripts/journeys/routes-without-journeys.json'), 'utf8'))
const routes = routesFromFiles(globSync('packages/{web,mobile}/app/**/*.tsx', { cwd: root }))
const routeErrors = routeTripwire(journeys, routes, optOuts)
if (routeErrors.length) {
  for (const e of routeErrors) console.error(e)
  process.exit(1)
}
const apiErrors = apiPathsExist(journeys, (file) => { try { return readFileSync(resolve(root, file), 'utf8') } catch { return null } })
if (apiErrors.length) {
  for (const e of apiErrors) console.error(e)
  process.exit(1)
}
const placeholders = Object.values(optOuts).filter((r) => r.startsWith('TODO:')).length
const read = (file) => { try { return readFileSync(resolve(root, file), 'utf8') } catch { return null } }
const legacyList = JSON.parse(read('scripts/journeys/legacy-file-tags.json'))
const malformed = legacyErrors(legacyList, read).map((e) => `legacy-file-tags.json: ${e}`)
const legacy = new Set(legacyList)
const filesByLayer = {}
const unnamed = []
for (const [layer, { glob: pattern }] of Object.entries(LAYERS)) {
  filesByLayer[layer] = {}
  for (const file of globSync(pattern, { cwd: root }).sort()) {
    const text = read(file)
    const { ids, errors } = fileClaims(file, text, legacy)
    if (file.endsWith('.yaml') && yamlName(text) === undefined) unnamed.push(file)
    for (const e of errors) malformed.push(`${file}: ${e}`)
    if (ids.length) filesByLayer[layer][file] = ids
  }
}
const cov = coverage(journeys, filesByLayer)
const doc = renderDoc(journeys, cov, legacy.size, Object.keys(optOuts).length)
const docPath = resolve(root, 'docs/testing/journeys.md')
if (process.argv.includes('--write')) {
  writeFileSync(docPath, doc)
  console.log(`wrote ${docPath}: ${cov.gaps.length} gaps, ${cov.waived.length} waived`)
  process.exit(0)
}
let failed = false
const say = (title, items, fmt) => { if (items.length) { failed = true; console.error(`\n${title} (${items.length})`); for (const i of items) console.error('  ' + fmt(i)) } }
say('Malformed tags', malformed, (m) => m)
say('Unknown journey ids', cov.unknown, (u) => `${u.file}: ${u.id}`)
say('Required layers with no tagged test', cov.gaps, (g) => `${g.id} ${g.layer}`)
let current = ''
try { current = readFileSync(docPath, 'utf8') } catch {}
if (current !== doc) { failed = true; console.error('\ndocs/testing/journeys.md is stale: run pnpm test:journeys:write') }
if (cov.waived.length) { console.log(`\nWaived (${cov.waived.length})`); for (const w of cov.waived) console.log(`  ${w.id} ${w.layer}: ${w.reason}`) }
if (unnamed.length) { console.log(`\nflows without a name (${unnamed.length})`); for (const f of unnamed) console.log('  ' + f) }
console.log(`\nroutes without rows: ${Object.keys(optOuts).length} (${placeholders} placeholders)`)
console.log(`\nlegacy file-level tags: ${legacy.size} files`)
console.log(`\n${journeys.length} journeys, ${cov.gaps.length} gaps`)
process.exit(failed ? 1 : 0)
