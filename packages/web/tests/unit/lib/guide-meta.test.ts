import { describe, it, expect } from 'vitest'
import { guideMeta } from '@splat-connect/types'

describe('guideMeta', () => {
  it('reads difficulty, time, then whatever the row adds, in the board order', () => {
    expect(guideMeta({ difficulty: 'easy', build_minutes: 20 }, '2.1k views')).toBe('Easy · 20 min · 2.1k views')
  })
  it('drops a missing time and an empty tail rather than printing a gap', () => {
    expect(guideMeta({ difficulty: 'hard', build_minutes: null }, null, undefined, 'Rachel Kaur')).toBe('Hard · Rachel Kaur')
  })
  it('uses the shared build-time format past the hour', () => {
    expect(guideMeta({ difficulty: 'medium', build_minutes: 90 })).toBe('Medium · 1.5 h')
  })
})
