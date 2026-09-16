import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, it, expect } from 'vitest'

/**
 * Why:   layout.tsx declares the fonts and then has to wire each variable onto
 *        <html> twice, once per branch. Declaring a face and forgetting one
 *        branch is silent — the page just falls back, and it falls back to a
 *        stack that looks close enough to pass a glance.
 * How:   asserts both halves for both faces: the next/font import exists, and
 *        the variable reaches the element.
 */
describe('the Soft Pop faces', () => {
  it('imports Baloo 2 and wires it into both html branches', () => {
    const dir = dirname(fileURLToPath(import.meta.url))
    const src = readFileSync(join(dir, '../../../app/layout.tsx'), 'utf8')
    expect(src).toContain('Baloo_2')
    expect(src.match(/baloo\.variable/g) ?? []).toHaveLength(2)
  })

  it('imports JetBrains Mono for numerics and wires it into both branches', () => {
    const dir = dirname(fileURLToPath(import.meta.url))
    const src = readFileSync(join(dir, '../../../app/layout.tsx'), 'utf8')
    expect(src).toContain('JetBrains_Mono')
    expect(src.match(/jetbrainsMono\.variable/g) ?? []).toHaveLength(2)
  })

  it('has dropped the faces the previous system used', () => {
    const dir = dirname(fileURLToPath(import.meta.url))
    const src = readFileSync(join(dir, '../../../app/layout.tsx'), 'utf8')
    // Imports only — the prose above these declarations explains what they
    // replaced, and a bare string grep would match that explanation.
    expect(src).not.toMatch(/from 'next\/font\/google'[\s\S]{0,200}Jersey_10/)
    expect(src).not.toMatch(/IBM_Plex_Mono\s*\(/)
  })
})
