#!/usr/bin/env node
// Which journey rows and tests does a change touch? `for-files.mjs <path>...` (or paths on stdin)
// prints lines verify-plan.sh reads: `row <id> <platform> <route>`, `e2e <platform> <spec>`,
// `unit <repo path>` (unit and api files), `missing no journey row: ...`, `fallback <path>`.
import { readFileSync, globSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LAYERS, fileClaims, routesFromFiles } from './lib.mjs'

const E2E = { 'web-e2e': 'web', 'mobile-e2e': 'mobile' }
const isCode = (f) => /^packages\/.*\.(ts|tsx)$/.test(f)

// filesByLayer is { layer: { file: ids } } as check.mjs builds it; optOuts is routes-without-journeys.json.
export function forFiles(changed, rows, filesByLayer, optOuts = {}) {
  const out = { rows: [], e2e: [], unit: [], missing: [], fallback: [] }
  const seen = new Set()
  for (const file of changed.filter(isCode)) {
    const { web, mobile } = routesFromFiles([file])
    const key = web.length ? `web ${web[0]}` : mobile.length ? `mobile ${mobile[0]}` : null
    const hits = key ? rows.filter((r) => `${r.platform} ${r.route}` === key) : []
    if (!hits.length) {
      if (key && !(key in optOuts)) out.missing.push(`no journey row: ${key}`)
      out.fallback.push(file)
      continue
    }
    for (const r of hits) if (!seen.has(r.id)) { seen.add(r.id); out.rows.push(r) }
  }
  for (const [layer, files] of Object.entries(filesByLayer)) {
    if (layer === 'device') continue
    for (const [file, ids] of Object.entries(files)) {
      if (!ids.some((id) => seen.has(id))) continue
      if (E2E[layer]) out.e2e.push(`${E2E[layer]} ${file.replace(/^packages\/[a-z]+\//, '')}`)
      else out.unit.push(file)
    }
  }
  out.rows.sort((a, b) => a.id.localeCompare(b.id))
  return out
}

export function format(out, changed) {
  if (!changed.some(isCode)) return ['nothing to run']
  return [
    ...out.rows.map((r) => `row ${r.id} ${r.platform} ${r.route}`),
    ...out.e2e.map((e) => `e2e ${e}`),
    ...out.unit.map((u) => `unit ${u}`),
    ...out.missing.map((m) => `missing ${m}`),
    ...out.fallback.map((f) => `fallback ${f}`),
  ]
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
  const read = (f) => readFileSync(resolve(root, f), 'utf8')
  const changed = process.argv.length > 2 ? process.argv.slice(2) : read('/dev/stdin').split('\n').filter(Boolean)
  const rows = JSON.parse(read('scripts/journeys/journeys.json'))
  const optOuts = JSON.parse(read('scripts/journeys/routes-without-journeys.json'))
  const filesByLayer = {}
  for (const [layer, { glob: pattern }] of Object.entries(LAYERS)) {
    filesByLayer[layer] = {}
    for (const file of globSync(pattern, { cwd: root }).sort()) {
      const { ids } = fileClaims(file, read(file))
      if (ids.length) filesByLayer[layer][file] = ids
    }
  }
  for (const line of format(forFiles(changed, rows, filesByLayer, optOuts), changed)) console.log(line)
}
