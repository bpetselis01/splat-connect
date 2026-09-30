// The registry (packages/types/src/pending.ts), the references in the code
// and docs/PENDING.md must agree. See the registry's header.
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PENDING, isPendingId, type PendingItem } from '@splat-connect/types'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const { references } = (await import(path.join(root, 'scripts/pending.mjs'))) as {
  references: () => Map<string, string[]>
}
const refs = references()
const entries = Object.entries(PENDING) as [string, PendingItem][]

describe('pending work stays in step', () => {
  it('every reference names a registered item', () => {
    expect([...refs.keys()].filter((id) => !isPendingId(id))).toEqual([])
  })
  it('every open item is referenced somewhere in the code', () => {
    const unreferenced = entries.filter(([id, i]) => !i.shipped && !refs.has(id)).map(([id]) => id)
    expect(unreferenced).toEqual([])
  })
  it('a shipped item leaves no references behind', () => {
    const left = entries.filter(([id, i]) => i.shipped && refs.has(id)).map(([id]) => id)
    expect(left).toEqual([])
  })
  // Line numbers would make the checklist stale on any unrelated edit above a
  // marker, and CI would go red for a change that touched no pending work.
  it('references name files, never line numbers', () => {
    const all = [...refs.values()].flat()
    expect(all.filter((r) => /:\d+$/.test(r))).toEqual([])
  })
  it('docs/PENDING.md is up to date', () => {
    expect(() => execFileSync('node', ['scripts/pending.mjs', '--check'], { cwd: root, stdio: 'pipe' })).not.toThrow()
  })
  // A parity exemption for unbuilt work lasts only while the work is open:
  // shipping the item turns this red until the exemption goes, and the
  // harness then measures the built feature.
  it('parity exemptions name open items and say why', () => {
    const read = (f: string) =>
      JSON.parse(readFileSync(path.join(root, 'scripts/parity', f), 'utf8')) as {
        id: string
        explained?: { why: string; reason?: string; pending?: string }[]
      }[]
    const map = [...read('screen-map.json'), ...read('app-screen-map.json')]
    const rules = map.flatMap((s) => (s.explained ?? []).map((r) => ({ screen: s.id, ...r })))
    const bad = rules.filter((r) =>
      r.why === 'pending'
        ? !r.pending || !isPendingId(r.pending) || (PENDING[r.pending] as PendingItem).shipped
        : !['intended', 'fixture', 'harness'].includes(r.why) || !r.reason,
    )
    expect(bad).toEqual([])
  })
})
