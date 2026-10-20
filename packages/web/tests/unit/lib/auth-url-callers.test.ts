import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

// The one builder is authUrl(); a hand-built `/signup?next=` string skips its sanitiser.
const root = resolve(__dirname, '../../..')
const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return sources(p)
    return /\.tsx?$/.test(e.name) ? [p] : []
  })

describe('links to /login and /signup', () => {
  const files = ['app', 'components', 'lib'].flatMap((d) => sources(join(root, d))).filter((f) => !f.endsWith('lib/safe-next-path.ts'))

  it('scans the real source tree', () => {
    expect(files.length).toBeGreaterThan(100)
  })

  it.each(files.map((f) => [f.slice(root.length + 1), f]))('%s builds none by hand', (_name, file) => {
    expect(readFileSync(file, 'utf8')).not.toMatch(/\/(login|signup)\?/)
  })
})
