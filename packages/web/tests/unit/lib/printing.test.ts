import { describe, it, expect } from 'vitest'
import { printCostCents, costRange, answerBy, needsAction, printRequestExpired } from '@splat-connect/types'

describe('printCostCents', () => {
  it('sums grams × quantity × rate', () => {
    expect(printCostCents([{ filament_grams: 10, quantity: 2 }, { filament_grams: 5 }], 12)).toBe(300)
  })
  it('is null with no rate — null is free, parts only (070)', () => {
    expect(printCostCents([{ filament_grams: 10 }], null)).toBeNull()
  })
  it('is null when any part lacks grams, rather than a confident undercount', () => {
    expect(printCostCents([{ filament_grams: 10 }, { filament_grams: null }], 12)).toBeNull()
  })
  it('is null at a rate of 0 — never "$0.00"', () => {
    expect(printCostCents([{ filament_grams: 10 }], 0)).toBeNull()
  })
  it('is null with nothing ticked', () => {
    expect(printCostCents([], 12)).toBeNull()
  })
})

describe('costRange', () => {
  it('spans the printers when every one has an estimate', () => {
    expect(costRange([300, 120])).toEqual([120, 300])
  })
  it('is null when any printer has none — no partial range', () => {
    expect(costRange([300, null, 120])).toBeNull()
  })
  it('is null when none has one', () => {
    expect(costRange([null, null])).toBeNull()
  })
})

const ago = (days: number) => new Date(Date.now() - days * 864e5).toISOString()

describe('answer by', () => {
  it('is seven days after the request', () => {
    expect(answerBy('2026-10-01T00:00:00.000Z')).toBe('2026-10-08T00:00:00.000Z')
  })
  it('expires only a request still waiting, only after the seven days', () => {
    expect(printRequestExpired({ status: 'requested', type: 'print', created_at: ago(6) })).toBe(false)
    expect(printRequestExpired({ status: 'requested', type: 'print', created_at: ago(8) })).toBe(true)
    expect(printRequestExpired({ status: 'accepted', type: 'print', created_at: ago(30) })).toBe(false)
    expect(printRequestExpired({ status: 'requested', type: 'print', created_at: null })).toBe(false)
  })
  it('never expires a request that is not a print — lists mix them', () => {
    expect(printRequestExpired({ status: 'requested', type: 'donation', created_at: ago(8) })).toBe(false)
  })
  it('stops an expired print request counting as waiting on the printer', () => {
    const tx = {
      status: 'requested', type: 'print', owner_id: 'p', owner_org_id: null, owner_confirmed_at: null,
      requester_confirmed_at: null, working_photo_url: null, work_approved_at: null, printing_started_at: null, ready_at: null,
    } as const
    expect(needsAction({ ...tx, created_at: ago(1) }, 'p')).toBe(true)
    expect(needsAction({ ...tx, created_at: ago(8) }, 'p')).toBe(false)
  })
})
