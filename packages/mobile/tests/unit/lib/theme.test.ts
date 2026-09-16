import { theme } from '../../../lib/theme'

// WCAG relative luminance — small enough to inline; the web's tone.test.ts does the same.
function lum(hex: string) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contrast(a: string, b: string) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

describe('Soft Pop theme', () => {
  it('carries the soft scales', () => {
    expect(theme.border).toEqual({ hairline: 1, thick: 2 })
    expect(theme.radii).toEqual({ field: 14, panel: 18, card: 24, pill: 999 })
    expect(theme.fonts.display).toBe('Baloo2_800ExtraBold')
    expect(theme.fonts.numeral).toBe('JetBrainsMono_400Regular')
  })

  /*
   * Why: shadow() changed meaning, not just values. Its argument used to be a
   * pixel offset (3 = the chip register, 6 = a launcher pillar) and is now an
   * elevation level 1-4 matching web's --e1..--e4. The two scales overlap, so
   * every old call site still compiled and would silently have rendered at the
   * wrong depth — shadow(4) went from a modest control shadow to the deepest
   * one in the system. Asserting the shape is what pins the new meaning down.
   */
  it('shadow(n) is a blurred elevation, matching the web e-scale', () => {
    expect(theme.shadow(2)).toEqual({
      shadowColor: '#1c2530',
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    })
    // Every level is blurred and vertical — no offset ladder survives.
    for (const level of [1, 2, 3, 4] as const) {
      const s = theme.shadow(level)
      expect(s.shadowRadius).toBeGreaterThan(0)
      expect(s.shadowOffset.width).toBe(0)
      expect(s.shadowOpacity).toBeLessThan(1)
    }
  })

  /*
   * Why: these are the same bg/fg pairs web's badge.tsx uses, and the two token
   * layers are only one contract as long as both sides move together.
   */
  it('every badge tone clears 4.5:1', () => {
    for (const [, { bg, fg }] of Object.entries(theme.colors.tone)) {
      expect(contrast(bg, fg)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('keeps a success shade that can carry white text', () => {
    expect(contrast(theme.colors.successDeep, '#ffffff')).toBeGreaterThanOrEqual(4.5)
  })
})
