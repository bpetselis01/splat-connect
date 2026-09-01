// The module under test lives in @splat-connect/types (both platforms use it);
// that package has no test runner of its own, so its one runnable check lives
// here, in the suite that already existed when the file moved.
import { deriveFitProfile, QUESTIONS } from '@splat-connect/types'

describe('deriveFitProfile (placeholder mapping)', () => {
  it('has exactly 4 questions, each with 4 options', () => {
    expect(QUESTIONS).toHaveLength(4)
    for (const q of QUESTIONS) expect(q.options).toHaveLength(4)
  })

  it.each([
    [[0, 0, 0, 0], 'I', '1'],
    [[1, 1, 1, 0], 'II', '2'],
    [[2, 2, 1, 1], 'III', '3'],
    [[3, 3, 2, 2], 'IV', '4'],
    [[3, 3, 3, 3], 'V', '5'],
  ])('answers %j -> internal %s / %s', (answers, macsInternal, bfmfInternal) => {
    expect(deriveFitProfile(answers as number[])).toEqual({ macsInternal, bfmfInternal })
  })

  it('throws on the wrong number of answers', () => {
    expect(() => deriveFitProfile([0, 0, 0])).toThrow()
  })
})
