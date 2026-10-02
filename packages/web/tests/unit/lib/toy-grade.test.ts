import { describe, it, expect } from 'vitest'
import { gradeOf, GRADES } from '@splat-connect/types'
import { gradeOf as webGrade } from '@/lib/toy-grade'

describe('gradeOf', () => {
  it('cuts the 1–10 scale where the board does', () => {
    expect([10, 9, 8, 7, 6, 5, 4, 1].map((c) => gradeOf(c).label)).toEqual([
      'Like new', 'Like new', 'Good', 'Good', 'Well-loved', 'Well-loved', 'Needs a fix', 'Needs a fix',
    ])
  })
  it('lists the four grades best first, for filter chips', () => {
    expect(GRADES.map((g) => g.key)).toEqual(['like-new', 'good', 'well-loved', 'needs-fix'])
  })
  it('gives web the same word with its tint', () => {
    expect(webGrade(8)).toEqual({ key: 'good', label: 'Good', min: 7, tint: 'var(--tmint)' })
  })
})
