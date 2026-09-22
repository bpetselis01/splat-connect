import { describe, it, expect } from 'vitest'
import { formatRelativeTime, agoInWords } from '@/lib/relative-time'

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

describe('agoInWords', () => {
  const now = new Date('2026-08-30T12:00:00.000Z')
  it('reads as a byline at each scale', () => {
    expect(agoInWords('2026-08-30T08:00:00.000Z', now)).toBe('today')
    expect(agoInWords('2026-08-29T08:00:00.000Z', now)).toBe('yesterday')
    expect(agoInWords('2026-08-09T12:00:00.000Z', now)).toBe('3 weeks ago')
    expect(agoInWords('2026-05-30T12:00:00.000Z', now)).toBe('3 months ago')
    expect(agoInWords('2024-08-01T12:00:00.000Z', now)).toBe('2 years ago')
  })
})
