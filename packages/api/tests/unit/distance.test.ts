import { describe, it, expect } from 'vitest'
import { readNear, byDistance } from '../../src/distance.js'

const q = (o: Record<string, string>) => (key: string) => o[key]

describe('readNear', () => {
  it('reads a postcode and a radius', () => {
    expect(readNear(q({ near: '2042', within: '10' }))).toEqual({ near: '2042', within: 10 })
    expect(readNear(q({}))).toEqual({ near: null, within: null })
  })
  it('refuses a postcode that is not four digits', () => {
    expect(readNear(q({ near: '20420' }))).toBe('near is a four-digit postcode.')
    expect(readNear(q({ near: 'NSW' }))).toBe('near is a four-digit postcode.')
  })
  it('refuses a radius that is not whole km from 1 to 5000', () => {
    for (const within of ['0', '2.5', '5001', 'ten']) {
      expect(readNear(q({ near: '2042', within }))).toBe('within is whole kilometres, 1 to 5000.')
    }
  })
})

describe('byDistance without near', () => {
  it('keeps the order and says nothing about distance', async () => {
    expect(await byDistance([{ id: 1 }, { id: 2 }], () => '2000', { near: null, within: null })).toEqual([
      { id: 1, km: null },
      { id: 2, km: null },
    ])
  })
})
