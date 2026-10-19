// Proves U1 changed no coverage mark: recomputes every id x layer cell and
// compares it with the snapshot taken before the move (argv[2]).
import { readFileSync, globSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LAYERS, parseTags, coverage } from '../lib.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const before = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const journeys = JSON.parse(readFileSync(resolve(root, 'scripts/journeys/journeys.json'), 'utf8'))
const filesByLayer = {}
for (const [layer, { glob }] of Object.entries(LAYERS)) {
  filesByLayer[layer] = {}
  for (const file of globSync(glob, { cwd: root })) {
    const { ids } = parseTags(readFileSync(resolve(root, file), 'utf8'))
    if (ids.length) filesByLayer[layer][file] = ids
  }
}
const cov = coverage(journeys, filesByLayer)
let diffs = 0
for (const j of journeys) {
  for (const layer of Object.keys(before[j.id])) {
    const now = !j.required.includes(layer) ? '-' : cov.covered[layer]?.has(j.id) ? 'ok' : j.waived?.[layer] ? 'waived' : 'gap'
    const was = before[j.id]?.[layer]
    if (now !== was) { diffs++; console.log(`${j.id} ${layer}: ${was} -> ${now}`) }
  }
}
console.log(`${journeys.length} rows, ${diffs} cell differences`)
process.exit(diffs ? 1 : 0)
