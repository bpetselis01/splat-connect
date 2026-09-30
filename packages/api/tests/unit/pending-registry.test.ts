import { describe, it, expect } from 'vitest'
import { PENDING, isPendingId, type PendingItem } from '@splat-connect/types'

const entries = Object.entries(PENDING) as [string, PendingItem][]

describe('pending registry', () => {
  it('holds the 104 items of the spec appendix', () => {
    expect(entries).toHaveLength(104)
  })
  it('uses kebab-case ids', () => {
    for (const [id] of entries) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })
  it('gives every item a title, blurb, needs and at least one platform', () => {
    for (const [id, item] of entries) {
      expect(item.title, id).not.toBe('')
      expect(item.blurb, id).not.toBe('')
      expect(item.needs, id).not.toBe('')
      expect(item.platforms.length, id).toBeGreaterThan(0)
    }
  })
  it('asks a question for every decision item, and only for those', () => {
    for (const [id, item] of entries) expect(Boolean(item.question), id).toBe(item.kind === 'decision')
  })
  it('recognises its own ids only', () => {
    expect(isPendingId('apple-sign-in')).toBe(true)
    expect(isPendingId('nope')).toBe(false)
  })
})
