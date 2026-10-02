import { describe, it, expect } from 'vitest'
import { formerCredit } from '../../src/former-contributor.js'

describe('formerCredit', () => {
  it.each([
    [[], 1, 'A former contributor'],
    [[], 2, '2 former contributors'],
    [['Sam'], 1, 'Sam'],
    [['Sam'], 2, 'Sam and 1 former contributor'],
    [['Sam', 'Priya'], 2, 'Sam and Priya'],
    [['Sam', 'Priya'], 4, 'Sam, Priya and 2 former contributors'],
  ])('%j of %i reads "%s"', (names, count, expected) => {
    expect(formerCredit(names as string[], count as number)).toBe(expected)
  })
})
