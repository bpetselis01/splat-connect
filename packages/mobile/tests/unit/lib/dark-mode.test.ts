// Dark mode (2026-10-05): both palettes keep their text readable, and no
// screen paints a colour the theme does not own, so nothing stays light-only.
import { PALETTES } from '../../../lib/theme'

type Entry = { name: string; isDirectory(): boolean }
const fs = require('fs') as { readdirSync(d: string, o: { withFileTypes: true }): Entry[]; readFileSync(f: string, e: 'utf8'): string }
const path = require('path') as { join(...p: string[]): string; resolve(...p: string[]): string; relative(a: string, b: string): string }
declare const __dirname: string
const ROOT = path.resolve(__dirname, '../../..')

function lum(hex: string) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

describe.each(Object.entries(PALETTES))('%s palette', (_, c) => {
  it('body and secondary text read on the screen and on cards', () => {
    for (const ground of [c.background, c.surface]) {
      expect(contrast(c.ink, ground)).toBeGreaterThanOrEqual(7)
      expect(contrast(c.muted, ground)).toBeGreaterThanOrEqual(4.5)
    }
  })
  it('every badge tone clears 4.5:1', () => {
    for (const { bg, fg } of Object.values(c.tone)) expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5)
  })
  it('the dark pills and the white-on-colour fills read', () => {
    expect(contrast(c.onInverse, c.inverse)).toBeGreaterThanOrEqual(7)
    expect(contrast(c.onColor, c.successDeep)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(c.onColor, c.dangerDeep)).toBeGreaterThanOrEqual(4.5)
  })
  it('link-blue text reads on the screen', () => {
    expect(contrast(c.primaryDeep, c.background)).toBeGreaterThanOrEqual(4.5)
  })
})

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? files(p) : /\.tsx?$/.test(e.name) ? [p] : []
  })
}

it('screens paint only theme colours (Apple’s sign-in button is the one exception, by Apple’s rules)', () => {
  const raw = ['components', 'app'].flatMap((d) =>
    files(path.join(ROOT, d)).flatMap((f) =>
      fs
        .readFileSync(f, 'utf8')
        .split('\n')
        .map((line, i) => ((/'#[0-9a-fA-F]{3,8}'|rgba?\(/.test(line) && !/theme\.dark \?/.test(line)) ? `${path.relative(ROOT, f)}:${i + 1}  ${line.trim()}` : null))
        .filter((x): x is string => !!x)
    )
  )
  expect(raw).toEqual([])
})
