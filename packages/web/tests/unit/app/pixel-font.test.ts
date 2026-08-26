import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, it, expect } from 'vitest'

describe('the Jersey 10 font', () => {
  it('is imported and wired into both html branches', () => {
    const dir = dirname(fileURLToPath(import.meta.url))
    const src = readFileSync(join(dir, '../../../app/layout.tsx'), 'utf8')
    expect(src).toContain('Jersey_10')
    expect(src).toContain('jersey.variable')
  })
})
