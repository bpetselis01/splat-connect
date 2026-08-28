import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * Guards on the shared press-motion block in app/globals.css.
 *
 * Every failure mode below is one that a browser renders without complaint and
 * a component test cannot see: jsdom does not resolve stylesheets, so the only
 * place these can be caught is by reading the CSS as text — the same technique
 * tone.test.ts uses to keep its contrast assertions honest.
 */
const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../app/globals.css'),
  'utf8',
)

/** The families driven by the shared block. */
const FAMILIES = ['.btn', '.card-link', '.chip', '.step-pill', '.dropzone', '.dock-my-splat', '.save-btn']

/**
 * Just the shared block, anchored on the LAST occurrence of the marker — the
 * removal notes earlier in globals.css quote the same phrase. Scoping matters:
 * `.btn-accent:hover:not(:disabled)` and
 * several `@media (prefers-reduced-motion)` blocks exist earlier in the file for
 * unrelated rules, so an unscoped search finds the wrong one and passes or fails
 * for the wrong reason.
 */
const BLOCK = css.slice(css.lastIndexOf('Press motion, in one place'))

/** The px value of --pop-rest in the rule whose selector contains `sel`. */
function restFor(sel: string): number | null {
  const at = BLOCK.indexOf(sel)
  if (at === -1) return null
  const m = BLOCK.slice(at, BLOCK.indexOf('}', at)).match(/--pop-rest:\s*([\d.]+)px/)
  return m ? Number(m[1]) : null
}

describe('press motion', () => {
  // Tests: the panel's :has() selector is never grouped with the base family list
  // How:   asserts no line carrying the base :is(...) list also carries :has(
  // Chain: THIS IS THE ONE THAT ALREADY BROKE. Tailwind compiles a comma group into a
  //        single :is(), and :is() takes the specificity of its most specific argument.
  //        `.panel:has(> .panel-summary)` scores (0,3,0), so grouping it with the base
  //        list dragged the whole rule to (0,3,0) and outranked every per-family
  //        --pop-rest override at (0,2,0). Result: every family computed --pop-rest: 0,
  //        every press travelled zero distance, and nothing errored. Keep them apart.
  it('never groups the panel :has() selector with the base family list', () => {
    const grouped = BLOCK
      .split('\n')
      .filter((l) => l.includes(':is(.btn,') && l.includes(':has('))
    expect(grouped).toEqual([])
  })

  // Tests: each family declares the resting depth its press travels by
  // How:   asserts a --pop-rest is set for the buttons, both card depths and the chip
  // Chain: press travels by --pop-rest, so a family that never sets one silently
  //        presses zero distance — visually identical to having no press at all,
  //        which is the state this whole block exists to fix
  it('gives every family with a resting shadow its own depth', () => {
    expect(restFor(':is(.btn-accent, .btn-primary, .btn-quiet)')).toBe(4)
    expect(restFor('.pixel .card {')).toBe(5)
    expect(restFor('.pixel .card-lead')).toBe(6)
    expect(restFor('.pixel .chip {')).toBe(3)
    // A selected chip rests flat (box-shadow: none), so 3px would slide it past
    // its own resting position on click with no shadow to sink into.
    expect(restFor(".pixel .chip[aria-pressed='true']")).toBe(0)
    // The panel moves in place of its summary, which cannot lift without being
    // clipped by the panel's own overflow: hidden.
    expect(restFor('.pixel .panel:has(> .panel-summary) {')).toBe(5)

    // The stepper joined the chip register on 2026-08-29. Same two depths and
    // the same reason: a selected pill rests flat, so it has nowhere to travel
    // and 3px would slide it past its own resting position.
    expect(restFor('.pixel .step-pill {')).toBe(3)
    expect(restFor('.pixel .step-pill[data-active]')).toBe(0)

    // The dock took a control's 4px when it stopped resting on a blurred halo.
    expect(restFor('.pixel .dock-my-splat {')).toBe(4)
  })

  // Tests: hover is gated behind a hover-capable pointer
  // How:   asserts the hover rule sits inside an @media (hover: hover) block
  // Chain: a touch device keeps :hover applied after a tap, so without this guard a
  //        tapped card stays visibly lifted on a phone until something else is
  //        tapped — a real bug on every one of these families before this block
  it('applies hover only on devices that can hover', () => {
    const guard = BLOCK.indexOf('@media (hover: hover)')
    const hoverRule = BLOCK.indexOf(':hover:not(:disabled)')
    expect(guard).toBeGreaterThan(-1)
    expect(hoverRule).toBeGreaterThan(guard)
    // Nothing between the guard and the rule may close the media block, or the
    // rule would sit outside it and apply on touch after all.
    expect(BLOCK.slice(guard, hoverRule)).not.toContain('\n  }\n')
  })

  // Tests: neither half of the motion fires on a disabled control
  // How:   asserts both the hover and active rules carry both disabled guards
  // Chain: a locked step-pill or a disabled submit that pops on hover tells the user
  //        it is pressable when it is not — the one case where the affordance lies
  it('never pops a disabled control', () => {
    for (const state of [':hover', ':active']) {
      const rule = BLOCK
        .split('\n')
        .find((l) => l.includes(`):${state.slice(1)}:not(`) && l.includes('.dock-my-splat'))
      expect(rule, `${state} rule not found`).toBeTruthy()
      expect(rule).toContain(':not(:disabled)')
      expect(rule).toContain(":not([aria-disabled='true'])")
    }
  })

  // Tests: reduced motion drops the travel but keeps the depth change
  // How:   asserts the reduced-motion block sets transform: none and no box-shadow
  // Chain: dropping both would leave a hover with no feedback at all, which is worse
  //        for the people the setting exists to serve than a shadow that resizes
  it('keeps a hover cue under reduced motion', () => {
    const i = BLOCK.lastIndexOf('@media (prefers-reduced-motion: reduce)')
    const block = BLOCK.slice(i, BLOCK.indexOf('\n  }\n', i))
    expect(block).toContain('transform: none')
    expect(block).not.toContain('box-shadow')
  })

  // Tests: the shared block actually covers every family it claims to
  // How:   asserts each family name appears in the base :is() list
  // Chain: a family dropped from the list keeps its class but loses all motion, and
  //        nothing anywhere reports it — it just quietly stops responding to a pointer
  it('drives every interactive family from the one block', () => {
    const base = BLOCK.split('\n').find((l) => l.includes('.pixel :is(.btn,') && l.endsWith('{'))
    expect(base).toBeTruthy()
    for (const f of FAMILIES) expect(base).toContain(f)
  })
})

/**
 * The save island sits over a card as a sibling of the card's anchor, so it
 * does not inherit the card's lift. These pin the two halves of that: the
 * button presses like every other family, and a separate rule moves it when the
 * CARD is hovered.
 */
describe('the save island', () => {
  it('joins the family group, so it presses by its own resting depth', () => {
    expect(BLOCK).toMatch(/--pop-rest:\s*3px/)
    expect(BLOCK).toContain('.save-btn')
  })

  it('lifts with the card through its own rule, not by joining the :is() group', () => {
    expect(BLOCK).toMatch(/\.pixel \.save-host:hover \.save-btn\s*\{/)

    // A descendant-with-pseudo-class selector folded into the family :is()
    // would change what the group matches AND hand the whole group this
    // selector's specificity — the same trap the block's own comment documents
    // for .panel:has(). Keep it out.
    expect(BLOCK).not.toMatch(/:is\([^)]*\.save-host/)
  })

  it('keeps that lift behind a hover-capable media query', () => {
    const at = BLOCK.indexOf('.pixel .save-host:hover .save-btn')
    const guard = BLOCK.lastIndexOf('@media (hover: hover)', at)
    const closes = BLOCK.lastIndexOf('}\n  }', at)
    // Without the guard a tapped card keeps the island lifted on a phone.
    expect(guard).toBeGreaterThan(-1)
    expect(guard).toBeGreaterThan(closes)
  })
})
