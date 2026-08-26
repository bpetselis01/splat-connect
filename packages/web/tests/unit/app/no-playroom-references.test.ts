import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, it, expect } from 'vitest'

describe('the playroom -> pixel rename', () => {
  it('app/layout.tsx no longer sets the retired .playroom class', () => {
    const dir = dirname(fileURLToPath(import.meta.url))
    const layoutPath = join(dir, '../../../app/layout.tsx')
    const src = readFileSync(layoutPath, 'utf8')
    expect(src).not.toContain('"playroom"')
    expect(src).toContain('"pixel"')
  })

  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        if (entry === 'node_modules' || entry === '.next' || entry === 'coverage') continue
        walk(full, out)
      } else if (/\.(ts|tsx|css)$/.test(entry)) {
        out.push(full)
      }
    }
    return out
  }

  it('leaves no "playroom" reference anywhere in app/ or components/', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '../../../')
    const offenders: string[] = []
    for (const dir of ['app', 'components']) {
      for (const file of walk(join(root, dir))) {
        if (readFileSync(file, 'utf8').toLowerCase().includes('playroom')) {
          offenders.push(file)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
