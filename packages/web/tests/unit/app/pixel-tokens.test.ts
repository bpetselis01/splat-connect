import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, it, expect } from 'vitest'

describe('pixel depth tokens', () => {
  const dir = dirname(fileURLToPath(import.meta.url))
  const css = readFileSync(join(dir, '../../../app/globals.css'), 'utf8')

  it('defines the hard-shadow depth scale', () => {
    expect(css).toMatch(/--shadow-pixel-sm:\s*2px 2px 0/)
    expect(css).toMatch(/--shadow-pixel-xs:\s*3px 3px 0/)
    expect(css).toMatch(/--shadow-pixel-md:\s*4px 4px 0/)
    expect(css).toMatch(/--shadow-pixel-card:\s*5px 5px 0/)
    expect(css).toMatch(/--shadow-pixel-lg:\s*6px 6px 0/)
  })

  /*
   * Six radii, because the artboard draws six. Counted from the artboard:
   * 10px ×28 (cards, empty states), 8px ×21 (buttons, avatars, step badges),
   * 6px ×15 (art slots, inputs), 20px ×9 (filter chips), 4px ×7 (SOON badge),
   * 2px ×4 (the smallest ticks).
   */
  it('defines the full pixel radius scale', () => {
    expect(css).toMatch(/--radius-pixel:\s*10px/)
    expect(css).toMatch(/--radius-pixel-sm:\s*8px/)
    expect(css).toMatch(/--radius-pixel-slot:\s*6px/)
    expect(css).toMatch(/--radius-pixel-chip:\s*20px/)
    expect(css).toMatch(/--radius-pixel-xs:\s*4px/)
    expect(css).toMatch(/--radius-pixel-hair:\s*2px/)
  })

  it('defines all three pixel border weights', () => {
    expect(css).toMatch(/--border-pixel:\s*3px/)
    expect(css).toMatch(/--border-pixel-thin:\s*2px/)
    expect(css).toMatch(/--border-pixel-hair:\s*1px/)
  })

  /*
   * The board's placeholder colour (#8aa7b8) reaches only 2.53:1 on white,
   * against this project's non-negotiable 4.5:1. Nothing near it passes —
   * you reach --color-muted (6.34:1) before you clear the bar — so the token
   * was withdrawn and placeholders keep --color-muted. This test stops the
   * board's value being reintroduced from the artboard by a later pass.
   */
  it('keeps placeholders on an accessible colour', () => {
    expect(css).not.toContain('#8aa7b8')
    expect(css).toMatch(/::placeholder\s*\{[^}]*var\(--color-muted\)/)
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

  /*
   * Jersey 10 is a numeral face, not a display face. Across all twelve screens
   * of the artboard it appears exactly three times — the homepage hero stat
   * chips, at 22px/700 — and every h1, h2 and h3 on every screen is Nunito.
   * The foundation pass read the 2026-08-26 spec ("display font, headings
   * only") rather than the board, and put it on the hero headline and the step
   * badges. See 2026-08-27-pixel-page-templates-design.md, Corrections §1.
   */
  it('keeps the display face off the headings', () => {
    const hero = css.match(/\.title-hero \{[^}]*\}/)?.[0] ?? ''
    expect(hero).not.toContain('--font-display')

    const step = css.match(/\.pixel \.step-pixel \{[^}]*\}/)?.[0] ?? ''
    expect(step).not.toContain('--font-display')
  })

  it('gives the display face exactly one home: the numeral class', () => {
    const numeral = css.match(/\.numeral \{[^}]*\}/)?.[0] ?? ''
    expect(numeral).toMatch(/font-family:\s*var\(--font-display\)/)

    // Exactly one consumer. The token's own definition reads
    // `--font-display: var(--font-jersey), ...` and so does not match this
    // pattern — .numeral is the only hit there should ever be.
    const uses = css.match(/var\(--font-display\)/g) ?? []
    expect(uses).toHaveLength(1)
  })

  /*
   * The filter chip is the one element that keeps a pill radius — the board
   * draws it at 20px while everything else came down to the 10/8/6/4 scale.
   * Its two states are drawn as a contrast, not a tint shift: inactive is
   * white and stands off the page on a 3px shadow, active is an ink fill lying
   * flat with no shadow at all.
   */
  it('draws the filter chip as the board does', () => {
    const chip = css.match(/\.chip \{[^}]*\}/)?.[0] ?? ''
    expect(chip).toMatch(/border-radius:\s*var\(--radius-pixel-chip\)/)
    expect(chip).toMatch(/border:\s*var\(--border-pixel-thin\) solid var\(--color-ink\)/)
    expect(chip).toMatch(/box-shadow:\s*var\(--shadow-pixel-xs\) var\(--color-ink\)/)
    expect(chip).not.toContain('9999px')

    const active = css.match(/\.chip\[aria-pressed='true'\] \{[^}]*\}/)?.[0] ?? ''
    expect(active).toMatch(/background-color:\s*var\(--color-ink\)/)
    expect(active).toMatch(/box-shadow:\s*none/)
  })

  it('draws the badge as the board draws SOON', () => {
    const badge = css.match(/\.badge \{[^}]*\}/)?.[0] ?? ''
    expect(badge).toMatch(/border-radius:\s*var\(--radius-pixel-xs\)/)
    expect(badge).toMatch(/border:\s*var\(--border-pixel-hair\) solid currentColor/)
    expect(badge).not.toContain('9999px')
  })

  /* The board has no scale transform anywhere; a chip presses the same way a
     button does — it travels its own shadow offset and the edge disappears. */
  it('presses the chip by collapsing its shadow, not by scaling it', () => {
    const active = css.match(/\.chip:active \{[^}]*\}/)?.[0] ?? ''
    expect(active).not.toContain('scale(')
    expect(active).toMatch(/translate\(3px, 3px\)/)
  })
})
