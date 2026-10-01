import { describe, it, expect } from 'vitest'
import { BUILD_URGENCIES, buildRowMeta } from '@splat-connect/types'

describe('BUILD_URGENCIES', () => {
  it('is the board’s How soon? list, in its order', () => {
    expect(BUILD_URGENCIES).toEqual(['No rush', 'This month', 'Before holidays'])
  })
})

describe('buildRowMeta', () => {
  it('reads time then rough cost, leaving out whichever is unknown', () => {
    expect(buildRowMeta({ build_minutes: 20, parts_total_cents: 2800 })).toBe('20 min · ~$28.00')
    expect(buildRowMeta({ build_minutes: 90, parts_total_cents: null })).toBe('1.5 h')
    expect(buildRowMeta({ build_minutes: null, parts_total_cents: 600 })).toBe('~$6.00')
    expect(buildRowMeta({ build_minutes: null, parts_total_cents: null })).toBeNull()
  })
})
