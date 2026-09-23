import { describe, it, expect } from 'vitest'
import { collapsePrintGroups } from '@splat-connect/types'

const row = (id: string, print_group_id: string | null, status: string) => ({ id, print_group_id, status }) as any

describe('collapsePrintGroups', () => {
  it('shows one row per request, led by the job that was taken, in the original order', () => {
    const out = collapsePrintGroups([
      row('solo', null, 'requested'),
      row('g1-a', 'g1', 'withdrawn'),
      row('g1-b', 'g1', 'accepted'),
      row('g2-a', 'g2', 'requested'),
      row('g2-b', 'g2', 'rejected'),
    ])
    expect(out.map((r) => [r.id, r.print_group_size])).toEqual([
      ['solo', 1],
      ['g1-b', 2],
      ['g2-a', 2],
    ])
  })
})
