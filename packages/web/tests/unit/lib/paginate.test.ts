import { describe, it, expect } from 'vitest'
import { paginate } from '@/lib/paginate'

const list = Array.from({ length: 25 }, (_, i) => i)

describe('paginate', () => {
  it('slices the asked-for page', () => {
    expect(paginate(list, '2', 10)).toEqual({ items: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19], page: 2, pages: 3, total: 25 })
  })

  it('clamps a page past either end, and reads junk as page 1', () => {
    expect(paginate(list, '9', 10).page).toBe(3)
    expect(paginate(list, '9', 10).items).toEqual([20, 21, 22, 23, 24])
    expect(paginate(list, '0', 10).page).toBe(1)
    expect(paginate(list, 'abc', 10).page).toBe(1)
    expect(paginate(list, undefined, 10).page).toBe(1)
  })

  it('has one empty page for an empty list', () => {
    expect(paginate([], '3', 10)).toEqual({ items: [], page: 1, pages: 1, total: 0 })
  })
})
