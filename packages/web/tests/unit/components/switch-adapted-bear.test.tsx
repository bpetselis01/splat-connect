import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SwitchAdaptedBear, bearGrid, switchGrid } from '@/components/switch-adapted-bear'

// The grids are asserted directly rather than through a canvas mock. jsdom has
// no 2D context, so a rendering test could only ever prove that fillRect was
// called — never that the bear has two eyes or that the cap sinks on press,
// which is the entire content of the design handoff.

/** Every distinct colour in a grid, for asserting a palette shift. */
const colours = (grid: (string | null)[][]) =>
  new Set(grid.flat().filter((c): c is string => c !== null))

describe('switch-adapted bear', () => {
  // Tests: the blob rasteriser leaves a one-cell outline around every filled shape
  // How:   walks the switch's base plate row and asserts the run reads outline,
  //        fill…, outline rather than fill edge to edge
  // Chain: this ring is what makes the art read as pixel art. Drawing the same
  //        ellipses with a stroked path or an SVG would produce smooth curves and
  //        lose the aesthetic the handoff calls the deliverable
  it('rasterises shapes with a one-cell outline ring', () => {
    const row = switchGrid(false)[12].filter((c) => c !== null)

    expect(row[0]).toBe('#000000')
    expect(row[row.length - 1]).toBe('#000000')
    expect(row.slice(1, -1)).toContain('#242424')
  })

  // Tests: the bear's face lands on exact grid cells
  // How:   asserts two eye cells and two nose cells in the dark ink at rest
  // Chain: eyes and nose are the only single-cell features. Drawn as sub-cell
  //        ellipses they would smear across neighbouring cells as the bear bobs,
  //        and the face would flicker every frame
  it('draws the face on whole cells', () => {
    const grid = bearGrid(0, false)

    expect(grid[6][10]).toBe('#2a1810')
    expect(grid[6][14]).toBe('#2a1810')
    expect(grid[9][11]).toBe('#2a1810')
    expect(grid[9][12]).toBe('#2a1810')
  })

  // Tests: pressing lights the belly badge
  // How:   compares the palette at rest against the palette while pressed
  // Chain: the glow is the payoff — the whole point is that the child's press
  //        makes something happen on the toy, not on the button
  it('lights the belly badge only while pressed', () => {
    expect(colours(bearGrid(0, false))).not.toContain('#f0b429')

    const lit = colours(bearGrid(0, true))
    expect(lit).toContain('#f0b429')
    expect(lit).toContain('#ffe08a')
  })

  // Tests: the arms alternate rather than waving in unison
  // How:   samples two 0.32s half-cycles and asserts the raised arm swaps sides
  // Chain: both arms up and down together reads as a jump, not a wave. The
  //        alternation is what makes it read as a bear reacting
  it('alternates the arms across the wave cycle', () => {
    const leftRaised = (t: number) => bearGrid(t, true)[9][6] !== null
    const rightRaised = (t: number) => bearGrid(t, true)[9][18] !== null

    expect(leftRaised(0.1)).toBe(true)
    expect(rightRaised(0.1)).toBe(false)

    expect(leftRaised(0.4)).toBe(false)
    expect(rightRaised(0.4)).toBe(true)
  })

  // Tests: the switch cap sinks on press and never changes colour
  // How:   asserts the cap's top edge moves down while the teal palette holds
  // Chain: a real accessibility switch gives mechanical feedback, not a light
  //        show. Recolouring the cap would move the payoff off the toy and onto
  //        the button, which is the opposite of what the product does
  it('sinks the cap on press without recolouring it', () => {
    const capTop = (pressed: boolean) =>
      switchGrid(pressed).findIndex((row) => row.includes('#2fbf9f'))

    expect(capTop(true)).toBeGreaterThan(capTop(false))

    for (const pressed of [false, true]) {
      const set = colours(switchGrid(pressed))
      expect(set).toContain('#2fbf9f')
      expect(set).toContain('#0f6f9c')
      expect(set).toContain('#8fe0cd')
    }
  })

  // Tests: the switch is operable by keyboard, holding while the key is down
  // How:   fires keydown/keyup on the button and reads aria-pressed
  // Chain: the mascot for a charity about switch access cannot itself be
  //        pointer-only. A plain onClick would have made the keyboard a toggle
  //        while everyone else got hold-to-play
  it('holds the switch from the keyboard', () => {
    render(<SwitchAdaptedBear />)
    const button = screen.getByRole('button')

    expect(button).toHaveAttribute('aria-pressed', 'false')

    fireEvent.keyDown(button, { key: ' ' })
    expect(button).toHaveAttribute('aria-pressed', 'true')

    fireEvent.keyUp(button, { key: ' ' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  // Tests: dragging off the switch cancels the press
  // How:   fires pointerdown then pointerleave without a pointerup
  // Chain: without the leave handler the bear waves forever after a drag-off,
  //        because the pointerup lands on whatever the pointer moved onto
  it('cancels the press when the pointer leaves', () => {
    render(<SwitchAdaptedBear />)
    const button = screen.getByRole('button')

    fireEvent.pointerDown(button)
    expect(button).toHaveAttribute('aria-pressed', 'true')

    fireEvent.pointerLeave(button)
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })
})
