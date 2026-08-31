import { describe, it, expect } from 'vitest'
import { chunk } from '../../src/chunk.js'

describe('chunk', () => {
  it('splits so no batch exceeds the size that fits a URL', () => {
    const parts = chunk(Array.from({ length: 454 }, (_, i) => i))
    expect(parts).toHaveLength(5)
    expect(Math.max(...parts.map((p) => p.length))).toBeLessThanOrEqual(100)
    expect(parts.flat()).toHaveLength(454)
  })

  it('passes small lists through as one batch and empty as none', () => {
    expect(chunk([1, 2, 3])).toEqual([[1, 2, 3]])
    expect(chunk([])).toEqual([])
  })
})
