import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, it, expect } from 'vitest'

describe('pixel depth tokens', () => {
  const dir = dirname(fileURLToPath(import.meta.url))
  const css = readFileSync(join(dir, '../../../app/globals.css'), 'utf8')

  it('defines the hard-shadow depth scale', () => {
    expect(css).toMatch(/--shadow-pixel-sm:\s*2px 2px 0/)
    expect(css).toMatch(/--shadow-pixel-md:\s*4px 4px 0/)
    expect(css).toMatch(/--shadow-pixel-lg:\s*6px 6px 0/)
  })

  it('defines the pixel border width', () => {
    expect(css).toMatch(/--border-pixel:\s*2px/)
  })

  it('wires the buttons to the diagonal shadow, not the old vertical one', () => {
    expect(css).toMatch(/\.pixel \.btn-accent \{[^}]*box-shadow: var\(--shadow-pixel-md\)/)
  })

  it('drops the squash-on-press transform', () => {
    expect(css).not.toContain('scaleY(0.94)')
  })

  it('wires the Jersey 10 display font into the theme', () => {
    expect(css).toMatch(/--font-display:\s*var\(--font-jersey\)/)
  })
})
