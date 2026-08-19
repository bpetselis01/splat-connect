import { describe, it, expect } from 'vitest'
import { TONES, toneClass, type Tone } from '@/lib/tone'

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

describe('tone', () => {
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
})
