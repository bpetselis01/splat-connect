import { kgToGrams, RECYCLING_DECLARATION } from '@splat-connect/types'
import {
  DROPOFF_PILL,
  badges,
  bookingProblem,
  canDecide,
  diverted,
  intakeProblem,
  takers,
} from '../../../lib/recycling'

const org = (over: object) => ({ id: 'o', name: 'O', status: 'active' as const, suburb: null, state: null, ...over })

describe('takers', () => {
  it('lists only active organisations that publish at least one polymer', () => {
    const list = takers([
      org({ id: 'a', recycling_materials: ['PLA'] }),
      org({ id: 'empty', recycling_materials: [] }),
      org({ id: 'unset' }),
      org({ id: 'suspended', status: 'suspended', recycling_materials: ['PLA'] }),
    ])
    expect(list.map((o) => o.id)).toEqual(['a'])
  })
})

describe('kgToGrams', () => {
  it('parses kilos to whole grams without floats', () => {
    expect(kgToGrams('2.1')).toBe(2100)
    expect(kgToGrams(' 3 ')).toBe(3000)
    expect(kgToGrams('0.125')).toBe(125)
    expect(kgToGrams('')).toBeNull()
    expect(kgToGrams('-1')).toBeNull()
    expect(kgToGrams('1.2345')).toBeNull()
    expect(kgToGrams('two')).toBeNull()
  })
})

describe('bookingProblem', () => {
  const all = RECYCLING_DECLARATION.length
  it('needs two kilos, a polymer and all seven lines, in that order', () => {
    expect(bookingProblem({ grams: 1999, material: 'PLA', ticked: all })).toMatch(/at least 2 kg/)
    expect(bookingProblem({ grams: null, material: 'PLA', ticked: all })).toMatch(/at least 2 kg/)
    expect(bookingProblem({ grams: 2000, material: '', ticked: all })).toMatch(/polymer/)
    expect(bookingProblem({ grams: 2000, material: 'PLA', ticked: all - 1 })).toBe('1 declaration line still to tick.')
    expect(bookingProblem({ grams: 2000, material: 'PLA', ticked: 0 })).toBe('7 declaration lines still to tick.')
    expect(bookingProblem({ grams: 2000, material: 'PLA', ticked: all })).toBeNull()
  })
})

describe('intakeProblem', () => {
  it('refuses a credit larger than the weight', () => {
    expect(intakeProblem('2', '2.5')).toEqual({ ok: false, message: 'Credit cannot be more than what was weighed.' })
  })
  it('accepts credit equal to or under the weight, in grams', () => {
    expect(intakeProblem('2.6', '1.95')).toEqual({ ok: true, weighed_grams: 2600, credit_grams: 1950 })
    expect(intakeProblem('2', '2')).toEqual({ ok: true, weighed_grams: 2000, credit_grams: 2000 })
    expect(intakeProblem('2', '0')).toEqual({ ok: true, weighed_grams: 2000, credit_grams: 0 })
  })
  it('asks for whichever box is missing', () => {
    expect(intakeProblem('', '1')).toMatchObject({ ok: false, message: expect.stringMatching(/weighed/) })
    expect(intakeProblem('2', '')).toMatchObject({ ok: false, message: expect.stringMatching(/credit/) })
  })
})

describe('status → pill and actions', () => {
  it('only a booked drop-off can be decided', () => {
    expect(canDecide({ status: 'booked' })).toBe(true)
    for (const s of ['received', 'declined', 'cancelled'] as const) expect(canDecide({ status: s })).toBe(false)
  })
  it('maps every status to a label and a Badge tone key', () => {
    expect(DROPOFF_PILL.booked).toEqual({ label: 'Booked in', badge: 'pending' })
    expect(DROPOFF_PILL.received).toEqual({ label: 'Credited', badge: 'completed' })
    expect(DROPOFF_PILL.declined).toEqual({ label: 'Turned away', badge: 'rejected' })
    expect(DROPOFF_PILL.cancelled.label).toBe('Cancelled')
  })
})

describe('diverted and badges', () => {
  const d = (status: string, weighed: number | null, credit: number | null) =>
    ({ status, weighed_grams: weighed, credit_grams: credit }) as never
  it('counts only received drop-offs', () => {
    expect(diverted([d('received', 3200, 2400), d('declined', null, null), d('booked', null, null)])).toEqual({
      grams: 3200,
      credit: 2400,
    })
  })
  it('earns milestones on weighed kilos', () => {
    const b = badges(5600)
    expect(b.map((x) => x.earned)).toEqual([true, true, false, false])
    expect(b[2].sub).toBe('19.4 kg to go')
  })
})
