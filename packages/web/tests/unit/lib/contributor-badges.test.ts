import { describe, it, expect } from 'vitest'
import { contributorBadges } from '@splat-connect/types'

const NOW = new Date('2026-09-22T00:00:00Z')
const ids = (input: Parameters<typeof contributorBadges>[0]) =>
  contributorBadges(input, NOW).map((b) => b.id)

describe('contributorBadges', () => {
  it('awards nothing to a brand-new account with nothing published', () => {
    expect(ids({ guides: 0, thanks: 0, orgBacked: false, since: '2026-09-01T00:00:00Z' })).toEqual([])
  })

  it('stacks the guide and thanks tiers cumulatively', () => {
    expect(ids({ guides: 25, thanks: 100, orgBacked: false, since: '2026-09-01T00:00:00Z' })).toEqual([
      'first-guide', 'guides-10', 'guides-25', 'thanks-10', 'thanks-100',
    ])
  })

  it('names an organisation-backed guide', () => {
    expect(ids({ guides: 1, thanks: 0, orgBacked: true, since: '2026-09-01T00:00:00Z' })).toEqual([
      'first-guide', 'org-backed',
    ])
  })

  it('counts whole years on SPLAT from created_at', () => {
    const one = contributorBadges({ guides: 0, thanks: 0, orgBacked: false, since: '2025-03-01T00:00:00Z' }, NOW)
    expect(one).toEqual([{ id: 'years-1', label: '1 year on SPLAT' }])
    const two = contributorBadges({ guides: 0, thanks: 0, orgBacked: false, since: '2024-03-01T00:00:00Z' }, NOW)
    expect(two.map((b) => b.label)).toEqual(['2 years on SPLAT'])
  })
})
