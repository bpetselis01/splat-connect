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
 *
 * Rewritten on 2026-09-17, not deleted, when Soft Pop replaced Pixel's press.
 * The rule it guards changed completely — Pixel popped a control up-left on
 * hover and down-right by its own --pop-rest on press, with a hard ink shadow;
 * Soft Pop lifts 2px to --e3 and presses with scale(.96) — but the hazard did
 * not. The specificity trap in the first test is what made the old block fail
 * silently, and it is exactly what let Pixel's block go on outranking Soft Pop's
 * `.btn:active` for a month after the tokens landed: the press was in the file
 * and never once on screen.
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
 * several `@media (prefers-reduced-motion)` blocks exist earlier in the file
 * for unrelated rules, so an unscoped search finds the wrong one and passes or
 * fails for the wrong reason.
 *
 * Bounded at the end too, at the `}` that closes the block's own
 * `@layer components` — every rule inside it is indented, so a brace in column
 * zero is the layer's. It ran to end-of-file until 2026-09-18, which was only
 * ever correct because this was the last section in the sheet. The moment a
 * later one grew a reduced-motion block of its own, the `lastIndexOf` below
 * retargeted onto it and the suite failed pointing at a rule it was never
 * written to guard — the same class of silent mis-scoping the block's own
 * comments warn about, in the test rather than the CSS.
 */
const PRESS = css.lastIndexOf('Press motion, in one place')
const BLOCK = css.slice(PRESS, css.indexOf('\n}\n', PRESS))

describe('press motion', () => {
  // Tests: the panel's :has() selector is never grouped with the base family list
  // How:   asserts no line carrying the base :is(...) list also carries :has(
  // Chain: THIS IS THE ONE THAT ALREADY BROKE. Tailwind compiles a comma group into a
  //        single :is(), and :is() takes the specificity of its most specific argument.
  //        `.panel:has(> .panel-summary)` scores (0,3,0), so grouping it with the base
  //        list dragged the whole rule to (0,3,0) and outranked every per-family
  //        override at (0,2,0), silently zeroing the press. Keep them apart.
  it('never groups the panel :has() selector with the base family list', () => {
    const grouped = BLOCK
      .split('\n')
      .filter((l) => l.includes(':is(.btn,') && l.includes(':has('))
    expect(grouped).toEqual([])
  })

  // Tests: the press is the artboard's scale, and nothing else
  // How:   reads the :active rule off the family group and the panel's twin
  // Chain: 0.96 is measured, not chosen — the artboard's states sheet renders a
  //        pressed 48px button at 46px, and packages/mobile/lib/theme.ts already
  //        sets the same number as motion.pressScale. A press that travels
  //        instead of scaling is Pixel's rule coming back
  it('presses by scaling to 0.96 and dropping the shadow', () => {
    for (const sel of [':is(.btn, .card-link, .chip, .step-pill, .dropzone, .dock-my-splat, .save-btn):active', '.panel:has(> .panel-summary:active)']) {
      const at = BLOCK.indexOf(sel)
      expect(at, `${sel} not found`).toBeGreaterThan(-1)
      const rule = BLOCK.slice(at, BLOCK.indexOf('}', at))
      expect(rule).toContain('transform: scale(0.96)')
      expect(rule).toContain('box-shadow: none')
    }
  })

  // Tests: no trace of Pixel's arithmetic survives
  // How:   the three custom properties the old block ran on
  // Chain: the two blocks cannot coexist. `.pixel :is(.btn, ...)` scores (0,2,0)
  //        and beats the `.btn:active` (0,1,0) that states the real press, so
  //        leaving any of it behind puts the diagonal pop back on screen while
  //        the stylesheet still reads as though Soft Pop won
  it('keeps none of Pixel\'s pop arithmetic', () => {
    expect(BLOCK).not.toContain('--pop-rest:')
    expect(BLOCK).not.toContain('--pop-lift:')
    expect(BLOCK).not.toContain('--pop-color:')
  })

  // Tests: hover lifts 2px and swaps the resting elevation for --e3
  // How:   reads the hover rule off the family group
  // Chain: both numbers are the artboard's. The fill is deliberately NOT part
  //        of it — the primary's hover keeps --b600, and darkening it to --b700
  //        made a hovered button indistinguishable from a sending one
  it('lifts 2px to --e3 on hover, without touching the fill', () => {
    const at = BLOCK.indexOf(':is(.btn, .card-link, .dropzone, .dock-my-splat, .save-btn):hover')
    expect(at).toBeGreaterThan(-1)
    const rule = BLOCK.slice(at, BLOCK.indexOf('}', at))
    expect(rule).toContain('transform: translateY(-2px)')
    expect(rule).toContain('box-shadow: var(--shadow-e3)')
    expect(rule).not.toContain('background-color')
  })

  // Tests: chips and step-pills are excluded from the hover lift
  // How:   asserts the hover group omits them while the press group includes them
  // Chain: the artboard draws a lift for the three button classes and nothing
  //        else. A 36px flat chip growing a 12px/28px shadow reads as a card,
  //        which is the hierarchy inverting itself on hover
  it('lifts the buttons and cards but not the chip register', () => {
    const hover = BLOCK.slice(BLOCK.indexOf('@media (hover: hover)'))
    const rule = hover.slice(0, hover.indexOf('{', hover.indexOf(':hover')))
    expect(rule).toContain('.btn')
    expect(rule).not.toContain('.chip')
    expect(rule).not.toContain('.step-pill')
  })

  // Tests: destructive is the one hover the artboard draws without a lift
  // How:   asserts its override sits AFTER the shared hover rule
  // Chain: both selectors score (0,2,0), so source order is the only thing that
  //        decides. Moved above the shared rule it loses, and delete buttons
  //        start jumping at the pointer — the opposite of what an outline
  //        destructive control is for
  it('overrides the lift for destructive, after the shared rule', () => {
    const shared = BLOCK.indexOf(':is(.btn, .card-link, .dropzone, .dock-my-splat, .save-btn):hover')
    const danger = BLOCK.indexOf('.pixel .btn-danger:hover')
    expect(danger).toBeGreaterThan(shared)
    const rule = BLOCK.slice(danger, BLOCK.indexOf('}', danger))
    expect(rule).toContain('transform: none')
    expect(rule).toContain('box-shadow: var(--shadow-e2)')
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
    for (const state of ['hover', 'active'] as const) {
      const rule = BLOCK
        .split('\n')
        .find((l) => l.includes(`):${state}:not(`) && l.includes('.dock-my-splat'))
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
  it('joins the family group, so it presses with everything else', () => {
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

/**
 * The forced-state rules that /design-system/states runs on. They sit in the
 * same block, after the press rules, because a forced state has to win against
 * a real pointer that is also over the control.
 */
describe('forced states', () => {
  it('mirrors the real rules rather than transcribing the artboard', () => {
    const at = BLOCK.indexOf("[data-state='hover']")
    expect(at).toBeGreaterThan(-1)
    const rule = BLOCK.slice(at, BLOCK.indexOf('}', at))
    // The same two declarations as the real hover, so the sheet cannot show a
    // state the product does not have.
    expect(rule).toContain('transform: translateY(-2px)')
    expect(rule).toContain('box-shadow: var(--shadow-e3)')
  })

  it('places them after the press rules, so a forced state beats a live pointer', () => {
    expect(BLOCK.indexOf("[data-state='active']")).toBeGreaterThan(
      BLOCK.indexOf(':is(.btn, .card-link, .chip, .step-pill, .dropzone, .dock-my-splat, .save-btn):active'),
    )
  })
})

/**
 * The one control whose pressed shadow is not `none`.
 */
describe('the primary under press', () => {
  // Tests: the glow survives the press, on both the live and the forced rule
  // How:   asserts the override exists after each of the two press rules
  // Chain: measured. A pressed "Request this toy" on the artboard's states
  //        sheet still carries --glow while a pressed "Save" drops --e2 — the
  //        glow is a coloured halo, not height, so it has no reason to collapse
  //        when the button is held. Without this the one control the eye is
  //        meant to follow flickers colourless for the length of a click
  it('keeps --glow while pressed', () => {
    for (const marker of [
      ":is(.btn-primary, .btn-accent):active:not(:disabled):not([aria-disabled='true'])",
      ":is(.btn-primary, .btn-accent)[data-state='active']",
    ]) {
      const at = BLOCK.indexOf(marker)
      expect(at, `${marker} not found`).toBeGreaterThan(-1)
      expect(BLOCK.slice(at, BLOCK.indexOf('}', at))).toContain('box-shadow: var(--shadow-glow)')
    }
  })
})
