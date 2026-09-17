import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, it, expect } from 'vitest'

/**
 * The Soft Pop guard. It replaces the Pixel one file-for-file rather than
 * deleting it, because what each assertion protects is a bug that actually
 * shipped, and those outlive the design system that was live when they did.
 *
 * jsdom does not resolve stylesheets, so reading globals.css as text is the
 * only way these failures are catchable at all.
 */
describe('soft pop tokens', () => {
  const dir = dirname(fileURLToPath(import.meta.url))
  const css = readFileSync(join(dir, '../../../app/globals.css'), 'utf8')

  /** Declarations only — comments quote these names while declaring nothing. */
  const declarations = css
    .split('\n')
    .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('/*') && !l.trim().startsWith('//'))
    .join('\n')

  it('defines the four elevations and the two effects', () => {
    expect(declarations).toMatch(/--shadow-e1:\s*0 1px 2px rgba\(28, 37, 48, 0\.06\)/)
    expect(declarations).toMatch(/--shadow-e2:\s*0 4px 12px rgba\(28, 37, 48, 0\.08\)/)
    expect(declarations).toMatch(/--shadow-e3:\s*0 12px 28px rgba\(28, 37, 48, 0\.10\)/)
    expect(declarations).toMatch(/--shadow-e4:\s*0 24px 48px rgba\(28, 37, 48, 0\.14\)/)
    expect(declarations).toMatch(/--shadow-glow:\s*0 8px 20px rgba\(25, 152, 213, 0\.28\)/)
    expect(declarations).toMatch(/--shadow-hi:\s*inset 0 1px 0 rgba\(255, 255, 255, 0\.7\)/)
  })

  it('defines the radius scale and one tokenised border width', () => {
    expect(declarations).toMatch(/--radius-field:\s*14px/)
    expect(declarations).toMatch(/--radius-inset:\s*18px/)
    expect(declarations).toMatch(/--radius-card:\s*24px/)
    expect(declarations).toMatch(/--radius-pill:\s*999px/)
    expect(declarations).toMatch(/--border-width:\s*1px/)
  })

  /*
   * Why: --radius-field was nearly deleted once while eight call sites still
   * consumed it, and the suite stayed green — every form input site-wide would
   * have lost its radius. Soft Pop happens to want 14px too, so it survived the
   * swap, but the guard is about the consumers rather than the value.
   */
  it('keeps --radius-field while anything still consumes it', () => {
    const consumers = css.match(/var\(--radius-field\)/g) ?? []
    if (consumers.length > 0) {
      expect(declarations).toMatch(/--radius-field:\s*\d+px/)
    }
  })

  /*
   * Why: the whole point of replacing the previous system was that its token
   * names would have gone on describing it. A --shadow-pixel-card holding a
   * blurred shadow is a lie the next reader pays for. Declarations only: the
   * header comment names them to explain what retired.
   */
  it('has no declaration left from the retired vocabulary', () => {
    expect(declarations).not.toMatch(/--shadow-pixel-/)
    expect(declarations).not.toMatch(/--radius-pixel/)
    expect(declarations).not.toMatch(/--border-pixel/)
    expect(declarations).not.toMatch(/--shadow-ink-quiet/)
    expect(declarations).not.toMatch(/--shadow-(rest|lift)\s*:/)
  })

  /*
   * Why: the artboard's markup is written against its own token names and uses
   * them about nine thousand times. If the alias layer drifts, a screen lifted
   * from the prototype renders with every colour unresolved — which shows up as
   * black-on-transparent, not as an error.
   */
  it('aliases the artboard token names onto the theme', () => {
    for (const name of ['--surface', '--surface2', '--canvas', '--ink', '--muted', '--line', '--bw']) {
      expect(declarations).toMatch(new RegExp(`\\${name}:\\s*var\\(`))
    }
    for (const name of ['--e1', '--e2', '--e3', '--e4', '--glow', '--hi']) {
      expect(declarations).toMatch(new RegExp(`\\${name}:\\s*var\\(--shadow-`))
    }
    expect(declarations).toMatch(/--b600:\s*var\(--color-brand-dark\)/)
    expect(declarations).toMatch(/--tink:\s*var\(--color-ink\)/)
  })

  /*
   * Why: high contrast is the mode nobody looks at. It sets every elevation to
   * none and doubles --bw, so depth there is carried entirely by borders. A
   * component that separates from its background with a shadow and no border
   * simply disappears. Asserting the mode exists is the cheap half; the
   * expensive half is remembering to look at it.
   */
  it('zeroes every elevation in high contrast and doubles the border', () => {
    const hc = css.slice(css.indexOf("body[data-mode='hc']"))
    const block = hc.slice(0, hc.indexOf('}'))
    for (const e of ['--e1', '--e2', '--e3', '--e4', '--glow', '--hi']) {
      expect(block).toMatch(new RegExp(`\\${e}:\\s*none`))
    }
    expect(block).toMatch(/--bw:\s*2px/)
    expect(block).toMatch(/--line:\s*#000000/)
  })

  it('defines a dark mode that redefines the alias layer, not the theme', () => {
    const dark = css.slice(css.indexOf("body[data-mode='dark']"))
    const block = dark.slice(0, dark.indexOf('}'))
    expect(block).toMatch(/--canvas:\s*#141a21/)
    expect(block).toMatch(/--ink:\s*#e7edf2/)
    // It must not reach back into the @theme layer, or light mode follows it.
    expect(block).not.toMatch(/--color-/)
  })

  /*
   * Why: brand (#1998d5) reaches only 3.2:1 on white and success (#2f9e6b)
   * only 3.37:1, so neither may carry a white label. Both have a darker
   * sibling for exactly that, and the pair is easy to collapse by "simplifying"
   * the palette later.
   */
  it('keeps a darker sibling for every hue that carries white text', () => {
    expect(declarations).toMatch(/--color-brand-dark:\s*#1179b0/)
    expect(declarations).toMatch(/--color-success-deep:\s*#237e51/)
  })

  it('keeps placeholders on an accessible colour', () => {
    expect(css).toMatch(/::placeholder[\s\S]{0,120}var\(--color-muted\)/)
  })
})
