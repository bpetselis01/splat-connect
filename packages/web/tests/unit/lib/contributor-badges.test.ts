import { describe, it, expect } from 'vitest'
import { contributorBadges, nextBadgeThreshold, nextBadgeLine, BADGE_RULES } from '@splat-connect/types'

const NOW = new Date('2026-09-22T00:00:00Z')
const ids = (input: Parameters<typeof contributorBadges>[0]) =>
  contributorBadges(input, NOW).map((b) => b.id)

describe('contributorBadges', () => {
  it('awards nothing to a brand-new account with nothing published', () => {
    expect(ids({ guides: 0, builds: 0, orgBacked: false, since: '2026-09-01T00:00:00Z' })).toEqual([])
  })

  it('stacks the guide tiers and awards 100 builds', () => {
    expect(ids({ guides: 25, builds: 100, orgBacked: false, since: '2026-09-01T00:00:00Z' })).toEqual([
      'first-guide', 'guides-10', 'guides-25', 'builds-100',
    ])
    expect(ids({ guides: 0, builds: 99, orgBacked: false, since: '2026-09-01T00:00:00Z' })).toEqual([])
  })

  it('names an organisation-backed guide', () => {
    expect(ids({ guides: 1, builds: 0, orgBacked: true, since: '2026-09-01T00:00:00Z' })).toEqual([
      'first-guide', 'org-backed',
    ])
  })

  it('counts whole years on SPLAT from created_at', () => {
    const one = contributorBadges({ guides: 0, builds: 0, orgBacked: false, since: '2025-03-01T00:00:00Z' }, NOW)
    expect(one).toEqual([{ id: 'years-1', label: '1 year on SPLAT' }])
    const two = contributorBadges({ guides: 0, builds: 0, orgBacked: false, since: '2024-03-01T00:00:00Z' }, NOW)
    expect(two.map((b) => b.label)).toEqual(['2 years on SPLAT'])
  })
})

describe('nextBadgeThreshold', () => {
  it('names the nearest unearned badge by remaining count', () => {
    expect(nextBadgeThreshold({ guides: 0, builds: 0 })).toEqual({ label: 'First guide', remaining: 1, what: 'guide' })
    expect(nextBadgeThreshold({ guides: 8, builds: 0 })).toEqual({ label: '10 guides', remaining: 2, what: 'guide' })
    expect(nextBadgeThreshold({ guides: 25, builds: 97 })).toEqual({ label: '100 builds', remaining: 3, what: 'build' })
  })

  it('is null once every count badge is earned', () => {
    expect(nextBadgeThreshold({ guides: 25, builds: 100 })).toBeNull()
    expect(nextBadgeLine({ guides: 25, builds: 100 })).toBeNull()
  })

  it('words the line and agrees with contributorBadges at the threshold', () => {
    expect(nextBadgeLine({ guides: 9, builds: 0 })).toBe('1 more guide for 10 guides')
    expect(nextBadgeLine({ guides: 8, builds: 0 })).toBe('2 more guides for 10 guides')
    expect(ids({ guides: 10, builds: 0, orgBacked: false, since: '2026-09-01T00:00:00Z' })).toContain('guides-10')
  })

  it('explains every badge', () => {
    expect(BADGE_RULES.map((r) => r.label)).toEqual(
      expect.arrayContaining(['First guide', '10 guides', '25 guides', 'Org backed', '100 builds']),
    )
  })
})
