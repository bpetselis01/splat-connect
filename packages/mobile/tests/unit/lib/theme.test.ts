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

describe('Pixel theme', () => {
  it('carries hard-edged tokens', () => {
    expect(theme.border).toEqual({ thin: 2, thick: 3 })
    expect(theme.radii).toEqual({ sm: 6, md: 8, lg: 10, pill: 20 })
    expect(theme.fonts.numeral).toBe('Jersey10_400Regular')
  })

  it('shadow(n) is a zero-blur offset of n in ink', () => {
    expect(theme.shadow(4)).toEqual({
      shadowColor: theme.colors.ink,
      shadowOpacity: 1,
      shadowRadius: 0,
      shadowOffset: { width: 4, height: 4 },
      elevation: 4,
    })
  })

  it('every badge tone clears 4.5:1', () => {
    for (const [name, { bg, fg }] of Object.entries(theme.colors.tone)) {
      expect(contrast(bg, fg)).toBeGreaterThanOrEqual(4.5)
    }
  })
})
