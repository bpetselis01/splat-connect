import { describe, it, expect } from 'vitest'
import { BUILD_URGENCIES } from '@splat-connect/types'

describe('BUILD_URGENCIES', () => {
  it('is the board’s How soon? list, in its order', () => {
    expect(BUILD_URGENCIES).toEqual(['No rush', 'This month', 'Before holidays'])
  })
})
