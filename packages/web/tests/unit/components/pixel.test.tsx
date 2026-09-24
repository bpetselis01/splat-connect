import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { PixelBackdrop } from '@/components/pixel-backdrop'
import { Sticker, Slot } from '@/components/slot'

describe('PixelBackdrop', () => {
  it('is decorative: hidden from assistive tech and never interactive', () => {
    const { container } = render(<PixelBackdrop tone="mint" />)
    const root = container.firstElementChild as HTMLElement
    expect(root.getAttribute('aria-hidden')).toBe('true')
    expect(root.className).toContain('pointer-events-none')
  })

  it('clips its shapes so a circle running off the edge cannot scroll the page', () => {
    const { container } = render(<PixelBackdrop tone="brand" />)
    expect((container.firstElementChild as HTMLElement).className).toContain('overflow-hidden')
  })

  it('takes its colour from the section tone', () => {
    // Rendered as honey deliberately. Two of the three circles are a fixed
    // apricot/mint pair on every page, so asserting either of those colours
    // would pass for every tone alike and prove nothing.
    const { container } = render(<PixelBackdrop tone="honey" />)
    expect(container.innerHTML).toContain('bg-honey-soft')
    expect(container.innerHTML).not.toContain('bg-brand-tint')
  })

  it('draws its shapes from the pale end of the ramp, never a saturated fill', () => {
    // The regression this guards: the shapes were once filled with the section's
    // *ink* rather than its tint, and saturated colour laid over the blue canvas
    // drags every hue toward the ground — honey went olive, sunken went grey, and
    // four of the seven sections ended up the same shade of mud. Only `-soft` and
    // `-tint` fills are safe at this size.
    const { container } = render(<PixelBackdrop tone="honey" />)
    const fills = container.innerHTML.match(/bg-[a-z-]+/g) ?? []
    expect(fills.length).toBeGreaterThan(0)
    for (const fill of fills) expect(fill).toMatch(/-(soft|tint)$/)
  })
})

describe('Sticker', () => {
  it('is decoration: hidden from assistive tech and never intercepts a click', () => {
    // It is pinned over card links, so a sticker that could take a click would
    // punch a dead spot in the middle of a navigation target.
    const { container } = render(<Sticker note="spark" />)
    const root = container.firstElementChild as HTMLElement
    expect(root.getAttribute('aria-hidden')).toBe('true')
    expect(root.className).toContain('pointer-events-none')
  })

  it('carries its brief in the title so the art is specified where it belongs', () => {
    const { container } = render(<Sticker note="Hand-drawn spark, apricot" />)
    expect((container.firstElementChild as HTMLElement).title).toBe('Hand-drawn spark, apricot')
  })

  it('shows the illustration when it has one, and the empty mark when it does not', () => {
    const filled = render(<Sticker art="switch" note="section art" />)
    expect(filled.container.querySelector('img')).toBeTruthy()
    expect(filled.container.textContent).not.toContain('ART')

    const empty = render(<Sticker note="to be drawn" />)
    expect(empty.container.querySelector('img')).toBeNull()
    expect(empty.container.textContent).toContain('ART')
  })

  it('reserves the same box filled or empty, so real art never reflows the page', () => {
    const filled = render(<Sticker art="switch" note="a" size="sm" />)
    const empty = render(<Sticker note="a" size="sm" />)
    const box = /h-\d+ w-\d+/
    const a = (filled.container.firstElementChild as HTMLElement).className.match(box)
    const b = (empty.container.firstElementChild as HTMLElement).className.match(box)
    expect(a?.[0]).toBe(b?.[0])
  })
})

describe('Slot', () => {
  // One caption, not a kind label above a brief. MediaSlot carries a single
  // uppercase line and the brief is what belongs in it — the kind is only the
  // fallback when a caller has nothing more specific to say.
  it('states the brief, and falls back to the kind without one', () => {
    const { container } = render(<Slot kind="animation" note="Switch press, toy lights up" />)
    expect(container.textContent).toContain('Switch press, toy lights up')
    const bare = render(<Slot kind="animation" note="" />)
    expect(bare.container.textContent).toContain('Animation')
  })

  it('is decoration, like everything else in this family', () => {
    const { container } = render(<Slot kind="overlay" note="grain" />)
    const root = container.firstElementChild as HTMLElement
    expect(root.getAttribute('aria-hidden')).toBe('true')
    expect(root.className).toContain('pointer-events-none')
  })
})

describe('Slot tone', () => {
  /*
   * The tone now sets the FILL, not the edge.
   *
   * These asserted a 2px brand-blue dash that took the section's deep colour via
   * border-current. That was Pixel's placeholder — loud enough to read as a
   * feature of the page. MediaSlot is a hairline dash in --line over the tint,
   * with a muted caption: a note to whoever supplies the photograph, not
   * decoration. The edge is the same in every section; only the fill moves.
   */
  it('takes the section colour as its fill when given a tone', () => {
    const { container } = render(<Slot kind="art" tone="honey" note="x" />)
    const slot = container.firstElementChild as HTMLElement
    expect(slot.className).toContain('border-dashed')
    expect(slot.className).toContain('border-line')
    expect(slot.style.backgroundColor).not.toBe('')
  })

  it('sits on the sunken fill when given no tone', () => {
    const { container } = render(<Slot kind="art" note="x" />)
    const slot = container.firstElementChild as HTMLElement
    expect(slot.className).toContain('bg-sunken')
    expect(slot.style.backgroundColor).toBe('')
  })

  /* Placeholders never reach a screen reader or swallow a click. */
  it('is decorative in every tone', () => {
    const { container } = render(<Slot kind="art" tone="mint" note="x" />)
    const slot = container.firstElementChild!
    expect(slot).toHaveAttribute('aria-hidden', 'true')
    expect(slot.className).toContain('pointer-events-none')
  })
})
