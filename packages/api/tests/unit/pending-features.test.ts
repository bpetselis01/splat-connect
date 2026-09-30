// Keeps the three records of unfinished sign-in work in step (see the header
// of packages/mobile/lib/pending-features.ts): the registry, the
// PENDING(<id>) markers in the code, and the checklist in docs/superpowers/plans.
//
// It lives in the API's suite, not mobile's, because it needs Node (git, fs)
// and the mobile tsconfig deliberately has no Node types. The registry is read
// as text for the same reason: importing it would pull in React Native types.
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const read = (p: string) => readFileSync(path.join(root, p), 'utf8')

const registry = read('packages/mobile/lib/pending-features.ts')
const body = registry.slice(registry.indexOf('export const PENDING_FEATURES'))
// Each entry is `  'id': {` at two-space indent, up to the next one.
const entries = [...body.matchAll(/^ {2}'([a-z0-9-]+)': \{([\s\S]*?)^ {2}\},?$/gm)].map((m) => ({
  id: m[1]!,
  shipped: /\bshipped:\s*true\b/.test(m[2]!),
}))
const checklist = read('docs/superpowers/plans/2026-09-30-sign-in-remaining-work.md')

// git grep sees tracked files only, so it never wanders into node_modules or
// ios/Pods. -I skips binaries.
const markers = execFileSync('git', ['grep', '-I', '-h', '-o', 'PENDING([a-z0-9-]*)', '--', '.', ':!**/pending-features.*'], {
  cwd: root,
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .filter(Boolean)
  .map((m) => m.slice('PENDING('.length, -1))

describe('pending sign-in work', () => {
  it('reads the registry', () => {
    expect(entries.length).toBeGreaterThan(0)
  })

  it('every marker names a registered item', () => {
    const ids = entries.map((e) => e.id)
    expect(markers.filter((m) => !ids.includes(m))).toEqual([])
  })

  it('every open item has a marker in the code and a row in the checklist', () => {
    const open = entries.filter((e) => !e.shipped).map((e) => e.id)
    expect(open.filter((id) => !markers.includes(id))).toEqual([])
    expect(open.filter((id) => !checklist.includes(`\`${id}\``))).toEqual([])
  })

  it('a shipped item leaves no markers behind', () => {
    const shipped = entries.filter((e) => e.shipped).map((e) => e.id)
    expect(markers.filter((m) => shipped.includes(m))).toEqual([])
  })
})
