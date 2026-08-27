import { describe, it, expect } from 'vitest'
import { TONES, toneClass, type Tone } from '@/lib/tone'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * WCAG relative luminance, sRGB. Computed here rather than eyeballed because the
 * public site serves families who include people with low vision, and because
 * globals.css already records one hard-won lesson of this kind: `brand` reaches
 * only 3.2:1 against white, which is why `brand-dark` exists at all.
 */
function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Composites `fg` over `bg` at `alpha` (CSS `opacity`, not alpha-channel
 * colour). The launcher-grid blurb never renders its ink at full strength —
 * a plain full-opacity ratio, which is all the tests below this point ever
 * checked, is not what a visitor actually sees.
 */
function blend(fg: string, bg: string, alpha: number): string {
  const mix = (i: number) => {
    const f = parseInt(fg.slice(i, i + 2), 16)
    const b = parseInt(bg.slice(i, i + 2), 16)
    return Math.round(f * alpha + b * (1 - alpha))
      .toString(16)
      .padStart(2, '0')
  }
  return `#${mix(1)}${mix(3)}${mix(5)}`
}

describe('tone', () => {
  /*
   * Pixel puts the muted blurb on a *tinted* card in every section — the old
   * layout only ever set it on white or on the canvas, so this pairing is new
   * and was never covered. Get Involved's #bfe4f5 is the tightest of the seven
   * and is what forced --color-muted darker; the shipped value is extracted
   * from globals.css and drives both contrast assertions, so they fail loudly
   * if the token ever drifts from its declared value. See Task 7 of
   * docs/superpowers/plans/2026-08-27-pixel-shared-layer.md for the full table.
   */
  const css = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../../../app/globals.css'),
    'utf8'
  )
  const MUTED = css.match(/--color-muted:\s*(#[0-9a-fA-F]{6})/)?.[1] ?? ''

  it('captures --color-muted from the stylesheet', () => {
    expect(MUTED).toMatch(/^#[0-9a-fA-F]{6}$/)
  })

  it('covers exactly the seven tones', () => {
    const expected: Tone[] = ['brand', 'mint', 'apricot', 'honey', 'sky', 'sunken', 'plain']
    expect(Object.keys(TONES).sort()).toEqual([...expected].sort())
  })

  it('every tone clears 4.5:1 for body text on its own surface', () => {
    for (const [name, spec] of Object.entries(TONES)) {
      expect(ratio(spec.hex.bg, spec.hex.fg), `${name}: ink on surface`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('every tone stays legible directly on the page canvas', () => {
    // Tone ink is also used for headings sitting on the canvas, not only inside
    // a toned card, so it has to clear the bar against #eaf4fa too.
    for (const [name, spec] of Object.entries(TONES)) {
      expect(ratio('#eaf4fa', spec.hex.fg), `${name}: ink on canvas`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('toneClass returns the spec for a tone', () => {
    expect(toneClass('mint')).toBe(TONES.mint)
  })

  it('keeps the card blurb legible on every tone surface', () => {
    for (const [name, spec] of Object.entries(TONES)) {
      expect(
        ratio(spec.hex.bg, MUTED),
        `${name}: muted blurb on surface`
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('keeps the muted blurb legible on the page canvas', () => {
    expect(ratio('#eaf4fa', MUTED)).toBeGreaterThanOrEqual(4.5)
  })

  /*
   * launcher-grid.tsx renders its blurb below full strength: a pillar sets
   * the tone's own ink at opacity-85, a supporting tile sets text-muted
   * (no opacity). Four tiles shipped under 4.5:1 because the tests above
   * only ever asserted full-opacity ratios — this composites the way the
   * launcher actually draws the pixel, so it would have caught it.
   */
  const PILLARS: Tone[] = ['brand', 'mint', 'apricot']
  const SUPPORTING: Tone[] = ['honey', 'sky', 'sunken', 'plain']
  const PILLAR_BLURB_OPACITY = 0.85 // launcher-grid.tsx pillar blurb

  it('keeps the pillar blurb legible at the opacity the launcher renders it', () => {
    for (const name of PILLARS) {
      const spec = TONES[name]
      const blended = blend(spec.hex.fg, spec.hex.bg, PILLAR_BLURB_OPACITY)
      expect(ratio(spec.hex.bg, blended), `${name}: pillar blurb`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('keeps the supporting-tile blurb legible: text-muted, full opacity, not tone ink', () => {
    for (const name of SUPPORTING) {
      const spec = TONES[name]
      expect(ratio(spec.hex.bg, MUTED), `${name}: supporting blurb`).toBeGreaterThanOrEqual(4.5)
    }
  })
})
