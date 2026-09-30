// The registry (packages/types/src/pending.ts), the references in the code
// and docs/PENDING.md must agree. See the registry's header.
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
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
  it('docs/PENDING.md is up to date', () => {
    expect(() => execFileSync('node', ['scripts/pending.mjs', '--check'], { cwd: root, stdio: 'pipe' })).not.toThrow()
  })
})
