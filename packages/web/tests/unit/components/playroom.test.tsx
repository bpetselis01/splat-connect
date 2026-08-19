import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Tilt, tiltClass } from '@/components/tilt'
import { PlayroomBackdrop } from '@/components/playroom-backdrop'

describe('Tilt', () => {
  it('cycles through the four fixed angles by index', () => {
    expect(tiltClass(0)).toBe('tilt-1')
    expect(tiltClass(1)).toBe('tilt-2')
    expect(tiltClass(3)).toBe('tilt-4')
    expect(tiltClass(4)).toBe('tilt-1')
  })

  it('is deterministic — the same index always gives the same angle', () => {
    // A random angle would differ between the server and client renders, so React
    // would either warn about the mismatch or visibly re-tilt the grid on
    // hydration. This is the guard on that.
    expect(tiltClass(7)).toBe(tiltClass(7))
    expect(tiltClass(7)).toBe(tiltClass(11))
  })

  it('survives a negative index rather than returning undefined', () => {
    expect(tiltClass(-1)).toBe('tilt-4')
  })

  it('keeps the caller’s own classes alongside the angle', () => {
    const { container } = render(
      <Tilt index={0} className="card">
        <i />
      </Tilt>
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.className).toContain('tilt-1')
    expect(root.className).toContain('card')
  })
})

describe('PlayroomBackdrop', () => {
  it('is decorative: hidden from assistive tech and never interactive', () => {
    const { container } = render(<PlayroomBackdrop tone="mint" />)
    const root = container.firstElementChild as HTMLElement
    expect(root.getAttribute('aria-hidden')).toBe('true')
    expect(root.className).toContain('pointer-events-none')
  })

  it('clips its shapes so a circle running off the edge cannot scroll the page', () => {
    const { container } = render(<PlayroomBackdrop tone="brand" />)
    expect((container.firstElementChild as HTMLElement).className).toContain('overflow-hidden')
  })

  it('takes its colour from the section tone', () => {
    const { container } = render(<PlayroomBackdrop tone="apricot" />)
    expect(container.innerHTML).toContain('bg-apricot')
  })
})
