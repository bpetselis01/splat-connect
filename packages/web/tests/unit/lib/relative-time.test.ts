import { describe, it, expect } from 'vitest'
import { formatRelativeTime } from '@/lib/relative-time'

describe('formatRelativeTime', () => {
  const now = new Date('2026-08-03T12:00:00.000Z')

  it('returns "just now" for under a minute', () => {
    expect(formatRelativeTime('2026-08-03T11:59:31.000Z', now)).toBe('just now')
  })

  it('returns minutes for under an hour', () => {
    expect(formatRelativeTime('2026-08-03T11:55:00.000Z', now)).toBe('5m ago')
  })

  it('returns hours for under a day', () => {
    expect(formatRelativeTime('2026-08-03T09:00:00.000Z', now)).toBe('3h ago')
  })

  it('returns days at a day or more', () => {
    expect(formatRelativeTime('2026-08-01T12:00:00.000Z', now)).toBe('2d ago')
  })

  it('clamps a timestamp slightly in the future to "just now"', () => {
    expect(formatRelativeTime('2026-08-03T12:00:05.000Z', now)).toBe('just now')
  })
})
