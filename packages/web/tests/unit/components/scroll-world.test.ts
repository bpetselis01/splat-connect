import { describe, it, expect } from 'vitest'
import { sceneStyle, SCENES } from '@/components/scroll-world'

const n = SCENES.length
// -0 and 0 are the same place on screen; toEqual is not told that.
const still = { scale: 1, opacity: 1, y: expect.closeTo(0), blur: 0 }

describe('scroll-world flight', () => {
  // Chain: the board's first scene is already in place when the section
  // arrives. A fly-in at p=0 would open the section on an empty stage.
  it('holds the first scene sharp and in place at the start', () => {
    expect(sceneStyle(0, 0, n)).toMatchObject(still)
    for (let i = 1; i < n; i++) expect(sceneStyle(0, i, n).opacity).toBe(0)
  })

  // Chain: each scene dwells — still and unblurred — through the middle of its
  // fifth of the scroll. Without the dwell every scene is always moving.
  it('dwells each scene through the middle of its segment', () => {
    for (let i = 0; i < n; i++) {
      const mid = (i + 0.5) / n
      expect(sceneStyle(mid, i, n)).toMatchObject(still)
    }
  })

  // Chain: arriving is small, blurred and below; leaving is large and blurred
  // past the camera — the two halves of the fly-through.
  it('flies in from below and out past the camera', () => {
    const arriving = sceneStyle(1 / n + 0.02, 1, n)
    expect(arriving.scale).toBeLessThan(1)
    expect(arriving.y).toBeGreaterThan(0)
    expect(arriving.blur).toBeGreaterThan(0)
    const leaving = sceneStyle(1 / n - 0.02, 0, n)
    expect(leaving.scale).toBeGreaterThan(1)
    expect(leaving.y).toBeLessThan(0)
    expect(leaving.blur).toBeGreaterThan(0)
  })

  // Chain: exactly one scene is readable at any dwell point — two overlapping
  // at full opacity is the slideshow bug this replaces.
  it('never shows two scenes at full opacity at once', () => {
    for (let k = 0; k <= 100; k++) {
      const p = k / 100
      const visible = SCENES.filter((_, i) => sceneStyle(p, i, n).opacity > 0.99)
      expect(visible.length).toBeLessThanOrEqual(1)
    }
  })
})
