import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, it, expect } from 'vitest'

/**
 * The pre-Pixel register must not come back.
 *
 * Every other guard in this directory asserts that one block says the right
 * thing today. None of them notices a *new* block written in the old
 * register — and that is exactly how the signed-in side drifted: the
 * foundation pass updated the classes it touched, and every class it did not
 * touch kept 16px corners and blurred halos for three months while nothing
 * failed.
 *
 * jsdom does not resolve stylesheets, so reading the file as text is the only
 * place this is catchable at all.
 */
const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../app/globals.css'),
  'utf8',
)

const LINES = css.split('\n')

/**
 * Where the component layer starts. Everything above it is @theme, which
 * legitimately DEFINES --shadow-rest and --shadow-lift; this guard is about
 * what consumes them.
 */
const FIRST = LINES.findIndex((l) => l.includes('@layer components')) + 1

/** A comment line, which may say "9999px" while declaring nothing. */
const isProse = (l: string) => /^\s*(\/\*|\*|\/\/)/.test(l)

/**
 * Every offending declaration, as `line: text`. Returning the location rather
 * than a boolean is deliberate — a failure here should tell you which rule
 * regressed, not merely that one did.
 */
function declarationsMatching(pattern: RegExp): string[] {
  return LINES.slice(FIRST)
    .map((line, i) => ({ n: FIRST + i + 1, line }))
    .filter(({ line }) => !isProse(line) && pattern.test(line))
    .map(({ n, line }) => `${n}: ${line.trim()}`)
}

describe('the soft register does not come back', () => {
  // Tests: no fully-round shape survives outside the two that earned it
  // How:   greps the component layer for 9999px
  // Chain: the pill radius was the loudest single tell that a page had not
  //        been through the Pixel pass. .chip and .step-pill keep a 20px pill
  //        via --radius-pixel-chip, which is a token, not a literal.
  it('has no 9999px left in the component layer', () => {
    expect(declarationsMatching(/9999px/)).toEqual([])
  })

  // Tests: no blurred depth cue survives
  // How:   greps for --shadow-rest / --shadow-lift outside @theme
  // Chain: a blurred halo under a bordered box is the "ghost card" look the
  //        foundation replaced. Both tokens still exist and are still defined;
  //        nothing in the component layer may consume them.
  it('consumes neither blurred shadow token', () => {
    expect(declarationsMatching(/var\(--shadow-(rest|lift)\)/)).toEqual([])
  })

  // Tests: no literal corner radius survives
  // How:   greps for border-radius with a rem/px literal, allowing the tokens
  // Chain: the board draws six radii and they are all tokenised. A literal is
  //        by definition outside the vocabulary, which is how 14px, 12px,
  //        1.25rem and 0.35rem all ended up in a file that had a scale.
  it('sets every corner from the radius scale, never a literal', () => {
    // The lookahead sits immediately after the colon, not after \s*: a
    // trailing \s* backtracks to zero width, which lets the engine test
    // "(?!var()" against the space and pass on every tokenised line. That bug
    // made this assertion report all 34 correct declarations as literals.
    const literals = declarationsMatching(/border[a-z-]*radius:(?!\s*var\()/)
      // 0 and none are not literals from the scale; they are the absence of one.
      .filter((l) => !/:\s*(0|none);/.test(l))
    expect(literals).toEqual([])
  })

  // Tests: no hairline border in --color-line survives on a surface
  // How:   greps for the 1px --color-line pair
  // Chain: --color-line is still right for a divider (divide-line, the
  //        composer's border-top). It is not right for the edge of a box,
  //        which is what .card-flat and .chat-bubble-theirs used it for.
  it('draws no box edge as a --color-line hairline', () => {
    expect(declarationsMatching(/border:\s*1(\.5)?px solid var\(--color-line\)/)).toEqual([])
  })
})
