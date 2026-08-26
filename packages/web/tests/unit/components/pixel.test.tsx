import { describe, it, expect, vi, afterEach } from 'vitest'
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
  it('names the kind and states the brief', () => {
    const { container } = render(<Slot kind="animation" note="Switch press, toy lights up" />)
    expect(container.textContent).toContain('Animation')
    expect(container.textContent).toContain('Switch press, toy lights up')
  })

  it('is decoration, like everything else in this family', () => {
    const { container } = render(<Slot kind="overlay" note="grain" />)
    const root = container.firstElementChild as HTMLElement
    expect(root.getAttribute('aria-hidden')).toBe('true')
    expect(root.className).toContain('pointer-events-none')
  })
})

describe('NEXT_PUBLIC_SLOTS=off', () => {
  // The whole point of the flag: dashed boxes must never reach a real family
  // just because nobody remembered to strip the placeholders out of forty pages.
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  async function loadWithSlotsOff() {
    vi.stubEnv('NEXT_PUBLIC_SLOTS', 'off')
    vi.resetModules()
    return import('@/components/slot')
  }

  it('hides an unfilled sticker entirely', async () => {
    const { Sticker: S } = await loadWithSlotsOff()
    const { container } = render(<S note="to be drawn" />)
    expect(container.firstElementChild).toBeNull()
  })

  it('still renders a sticker that has real art — that is the finished state', async () => {
    const { Sticker: S } = await loadWithSlotsOff()
    const { container } = render(<S art="switch" note="section art" />)
    expect(container.querySelector('img')).toBeTruthy()
  })

  it('hides animation and overlay slots, which have no finished fallback', async () => {
    const { Slot: L } = await loadWithSlotsOff()
    const { container } = render(<L kind="animation" note="press" />)
    expect(container.firstElementChild).toBeNull()
  })
})
