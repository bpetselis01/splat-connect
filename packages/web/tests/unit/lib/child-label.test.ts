import { describe, it, expect } from 'vitest'
import { childLabel } from '@/lib/child-label'

describe('childLabel', () => {
  it('uses the name when there is one', () => {
    expect(childLabel({ name: 'Emma' }, 0)).toBe('Emma')
  })

  // Chain: name is optional by design, so an unnamed child still needs to be
  //        distinguishable from its siblings in the list.
  it('falls back to a 1-based position when there is no name', () => {
    expect(childLabel({ name: null }, 0)).toBe('Child 1')
    expect(childLabel({ name: null }, 1)).toBe('Child 2')
  })

  // A name of spaces would otherwise render as an invisible label.
  it('treats a whitespace-only name as no name', () => {
    expect(childLabel({ name: '   ' }, 2)).toBe('Child 3')
  })
})
