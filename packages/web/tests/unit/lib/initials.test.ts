import { describe, it, expect } from 'vitest'
import { initials } from '@splat-connect/types'

describe('initials', () => {
  it('takes the first letter of the first two words, uppercased', () => {
    expect(initials('Sam Mitchell')).toBe('SM')
    expect(initials('  priya   nair  sharma ')).toBe('PN')
    expect(initials('Northbank')).toBe('N')
  })

  it('falls back when there is no name — empty by default, or what the caller asks for', () => {
    expect(initials('   ')).toBe('')
    expect(initials(null)).toBe('')
    expect(initials(undefined, '?')).toBe('?')
    expect(initials('', '?')).toBe('?')
  })
})
