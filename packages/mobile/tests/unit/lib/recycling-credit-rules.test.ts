// The numbers a recycling drop-off and its credit are made of. Grams are
// integers end to end: a credit two parties agreed between them must not lose
// a gram to binary floating point, go negative, or exceed what was weighed.
import {
  MIN_DROPOFF_GRAMS,
  RECYCLING_DECLARATION,
  estimatedCreditGrams,
  intakeCredit,
  kgToGrams,
  recyclingPerDrop,
  weighedInLine,
} from '@splat-connect/types'
import { badges, bookingProblem, diverted, kg, takers } from '../../../lib/recycling'

describe('kgToGrams on awkward typing', () => {
  it.each([
    ['0', 0],
    ['0.001', 1],
    ['2.', null],
    ['.5', null],
    ['2,5', null],
    ['1e3', null],
    ['+2', null],
    ['2 kg', null],
    ['٢', null],
    ['10000', null],
    ['9999.999', 9999999],
    ['1.10', 1100],
    ['0.1', 100],
    ['0.7', 700],
    ['   ', null],
    ['2\n', 2000],
    ['۲.۵', null],
  ])('reads %j as %j', (typed, grams) => {
    expect(kgToGrams(typed)).toBe(grams)
  })

  it('never produces a fractional or negative gram for any one-to-three-decimal weight', () => {
    for (let g = 0; g <= 5000; g += 7) {
      const typed = (g / 1000).toFixed(3)
      const parsed = kgToGrams(typed)
      expect(Number.isInteger(parsed)).toBe(true)
      expect(parsed).toBe(g)
    }
  })
})

describe('intakeCredit', () => {
  it('prefills three quarters of the weight, rounded down to a whole gram', () => {
    expect(estimatedCreditGrams(2001)).toBe(1500)
    expect(estimatedCreditGrams(2003)).toBe(1502)
    expect(intakeCredit('2.001', null)).toMatchObject({ ok: true, weighed_grams: 2001, credit_grams: 1500 })
  })

  it('asks for a weight before it shows a credit', () => {
    for (const typed of ['', '  ', '0', 'abc', '-3']) {
      expect(intakeCredit(typed, null)).toEqual({ ok: false, line: 'Weigh it to see the credit' })
    }
  })

  it('refuses a weight one gram under the two-kilo floor and takes the floor itself', () => {
    expect(intakeCredit('1.999', null).ok).toBe(false)
    expect(intakeCredit('1.999', null).line).toMatch(/Under the 2 kg minimum/)
    expect(intakeCredit('2', null)).toMatchObject({ ok: true, weighed_grams: MIN_DROPOFF_GRAMS })
  })

  it('takes a credit exactly equal to the weight, and refuses one gram more', () => {
    expect(intakeCredit('3', '3000')).toMatchObject({ ok: true, credit_grams: 3000 })
    expect(intakeCredit('3', '3001')).toEqual({ ok: false, line: 'Credit cannot be more than what was weighed.' })
  })

  it('takes a zero credit but never a negative, fractional or non-numeric one', () => {
    expect(intakeCredit('3', '0')).toMatchObject({ ok: true, credit_grams: 0 })
    for (const typed of ['-1', '1.5', '1,500', '1e3', 'abc', '', '   ', '＋5', '99999999']) {
      expect(intakeCredit('3', typed)).toEqual({ ok: false, line: 'Enter the credit in whole grams.' })
    }
  })

  it('reads a credit with spaces around it, and with leading zeros, as the same whole grams', () => {
    expect(intakeCredit('3', ' 2500 ')).toMatchObject({ ok: true, credit_grams: 2500 })
    expect(intakeCredit('3', '0042')).toMatchObject({ ok: true, credit_grams: 42 })
  })

  it('follows the weight while untouched, and keeps an edited credit when the weight rises', () => {
    expect(intakeCredit('4', null)).toMatchObject({ credit_grams: 3000 })
    expect(intakeCredit('8', '3000')).toMatchObject({ credit_grams: 3000 })
  })

  it('says what it credits in the board words', () => {
    expect(intakeCredit('4', null)).toMatchObject({ line: '3000 g credit' })
    expect(weighedInLine(2500, 1875, 'Sam "Sparky" <b>')).toBe('Weighed at 2.5 kg — 1875 g credit issued to Sam "Sparky" <b>')
  })
})

describe('bookingProblem at the edges', () => {
  const all = RECYCLING_DECLARATION.length

  it('holds a zero, negative or missing weight under the floor', () => {
    for (const grams of [0, -5, null]) {
      expect(bookingProblem({ grams, material: 'PLA', ticked: all })).toMatch(/at least 2 kg/)
    }
  })

  it('lets the platform floor stand under an organisation minimum set lower than it', () => {
    expect(bookingProblem({ grams: 1500, material: 'PLA', ticked: all, minGrams: 500 })).toBe('A drop needs to be at least 2 kg.')
  })

  it('names a fractional organisation minimum in kilos', () => {
    expect(bookingProblem({ grams: 2500, material: 'PLA', ticked: all, minGrams: 2750 })).toBe('A drop needs to be at least 2.75 kg.')
  })

  it('treats a missing maximum as no ceiling, and a maximum of exactly the weight as fine', () => {
    expect(bookingProblem({ grams: 9_999_999, material: 'PLA', ticked: all, maxGrams: null })).toBeNull()
    expect(bookingProblem({ grams: 8001, material: 'PLA', ticked: all, maxGrams: 8000, orgName: 'N' })).toBe('N takes at most 8 kg at once.')
  })

  it('counts a tick total above seven as nothing left to tick', () => {
    expect(bookingProblem({ grams: 2000, material: 'PLA', ticked: all + 3 })).toBeNull()
  })
})

describe('kilo display', () => {
  it.each([
    [0, '0.0 kg'],
    [49, '0.0 kg'],
    [50, '0.1 kg'],
    [2000, '2.0 kg'],
    [2049, '2.0 kg'],
    [12345, '12.3 kg'],
  ])('prints %i g as %s', (grams, text) => {
    expect(kg(grams)).toBe(text)
  })
})

describe('diverted totals with gaps in the data', () => {
  const d = (status: string, weighed: number | null, credit: number | null) => ({ status, weighed_grams: weighed, credit_grams: credit }) as never

  it('is zero for no drop-offs', () => {
    expect(diverted([])).toEqual({ grams: 0, credit: 0 })
  })

  it('counts a received row with null weights as zero rather than NaN', () => {
    expect(diverted([d('received', null, null), d('received', 2500, 1800)])).toEqual({ grams: 2500, credit: 1800 })
  })

  it('leaves out cancelled drop-offs as well as declined and booked ones', () => {
    expect(diverted([d('cancelled', 9000, 9000), d('declined', 9000, 9000), d('booked', 9000, 9000)])).toEqual({ grams: 0, credit: 0 })
  })

  it('adds many received drop-offs exactly', () => {
    const many = Array.from({ length: 1000 }, () => d('received', 2001, 1500))
    expect(diverted(many)).toEqual({ grams: 2_001_000, credit: 1_500_000 })
  })
})

describe('milestone badges at their boundaries', () => {
  it('earns nothing at zero grams, and says how far each is', () => {
    const b = badges(0)
    expect(b.map((x) => x.earned)).toEqual([false, false, false, false])
    expect(b[0].sub).toBe('0.1 kg to go')
  })

  it('earns First drop at exactly 100 g and not at 99', () => {
    expect(badges(99)[0].earned).toBe(false)
    expect(badges(100)[0]).toEqual({ label: 'First drop', earned: true, sub: 'Earned' })
  })

  it('earns every milestone past a hundred kilos', () => {
    expect(badges(100_000).every((x) => x.earned && x.sub === 'Earned')).toBe(true)
  })
})

describe('who can take plastic, with missing data', () => {
  const org = (over: object) => ({ id: 'o', name: 'O', status: 'active', suburb: null, state: null, ...over }) as never

  it('is empty for no organisations', () => {
    expect(takers([])).toEqual([])
  })

  it('keeps a pending organisation that publishes a polymer, and drops one with null materials', () => {
    const list = takers([org({ id: 'p', status: 'pending', recycling_materials: ['PLA'] }), org({ id: 'n', recycling_materials: null })])
    expect(list.map((o: { id: string }) => o.id)).toEqual(['p'])
  })
})

describe('the per-drop line', () => {
  it('stands the platform floor in for an unset minimum, and says From when there is no maximum', () => {
    expect(recyclingPerDrop({})).toBe('From 2 kg')
    expect(recyclingPerDrop({ recycling_min_kg: 3, recycling_max_kg: 8, recycling_turnaround: 'About 3 weeks' })).toBe('3–8 kg · About 3 weeks')
  })
})
