// packages/mobile/tests/unit/components/ui/Mascot.test.tsx
// Splat waves in on first appearance and then breathes, unless the phone asks
// for reduced motion, when it holds still.
import { act, render, screen } from '@testing-library/react-native'
import { getAnimatedStyle } from 'react-native-reanimated'
import { Mascot } from '../../../../components/ui/TabHero'

let mockReduced = false
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated')
  return { ...actual, __esModule: true, default: actual.default, useReducedMotion: () => mockReduced }
})

type Pose = { rotate: string; translateY: number; scale: number }
function pose(): Pose {
  const transform = (getAnimatedStyle(screen.getByTestId('mascot', { includeHiddenElements: true })).transform ?? []) as readonly object[]
  return Object.assign({ rotate: '0deg', translateY: 0, scale: 1 }, ...transform)
}
const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms))

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

describe('Mascot', () => {
  it('starts tilted, settles upright, then bobs', () => {
    mockReduced = false
    render(<Mascot pose="wave" size={72} />)
    expect(pose().rotate).not.toBe('0deg')
    advance(1200)
    expect(parseFloat(pose().rotate)).toBeCloseTo(0, 1)
    const seen = new Set<number>()
    for (let i = 0; i < 30; i++) {
      advance(100)
      seen.add(Math.round(pose().translateY * 10))
    }
    expect(seen.size).toBeGreaterThan(1)
  })

  it('holds still under reduced motion', () => {
    mockReduced = true
    render(<Mascot pose="wave" size={72} />)
    expect(pose()).toEqual({ rotate: '0deg', translateY: 0, scale: 1 })
    advance(3000)
    expect(pose()).toEqual({ rotate: '0deg', translateY: 0, scale: 1 })
  })

  it('stays hidden from screen readers', () => {
    mockReduced = true
    render(<Mascot pose="party" size={72} />)
    expect(screen.getByTestId('mascot', { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true)
  })
})
