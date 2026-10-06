import { stepTabBar } from '../../../lib/tab-bar-visibility'

// Feeds scroll offsets the way a finger does and returns the last decision.
const run = (ys: number[]) => {
  let ref = 0
  let hidden = false
  for (const y of ys) {
    const next = stepTabBar(ref, y)
    ref = next.ref
    if (next.hidden !== undefined) hidden = next.hidden
  }
  return hidden
}

it('hides on a deliberate scroll down past the top', () => {
  expect(run([0, 30, 60, 90, 120])).toBe(true)
})

it('ignores jitter smaller than the travel threshold', () => {
  for (const y of [92, 96, 104, 108]) expect(stepTabBar(100, y)).toEqual({ ref: 100 })
})

it('comes back on a small scroll up', () => {
  expect(run([0, 60, 120, 200, 185])).toBe(false)
})

it('stays hidden while a slow drift keeps heading down', () => {
  expect(run([0, 60, 120, 125, 131, 140, 150])).toBe(true)
})

it('comes back near the top', () => {
  expect(run([0, 100, 200, 30])).toBe(false)
})
