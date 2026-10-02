import { describe, it, expect } from 'vitest'
import { bedFits } from '@splat-connect/types'
import {
  printCostCents,
  costRange,
  answerBy,
  needsAction,
  printRequestExpired,
  machineStatsLines,
  orgPrintFacts,
  statsLine,
  guideFitLine,
} from '@splat-connect/types'

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

const stats = { jobs: 21, median_days: 3, fitted: 20, fit_answers: 21, colours: ['Black', 'White', 'Blue'] }

describe('printer stats', () => {
  it('reads as the find card says it', () => {
    expect(statsLine(stats)).toBe('21 jobs · ~3 days')
    expect(statsLine({ ...stats, jobs: 1, median_days: 1 })).toBe('1 job · ~1 day')
  })
  it('is hidden below one completed job', () => {
    expect(statsLine({ ...stats, jobs: 0, median_days: null })).toBeNull()
    expect(machineStatsLines({ ...stats, jobs: 0 })).toEqual([])
    expect(orgPrintFacts(undefined)).toEqual([])
  })
  it('gives the machine picker its three lines', () => {
    expect(machineStatsLines(stats)).toEqual([
      '21 completed · median 3 days',
      '20 of 21 fitted first time',
      'Colours: Black, White, Blue',
    ])
    expect(machineStatsLines({ ...stats, fit_answers: 0, colours: [] })).toEqual(['21 completed · median 3 days'])
  })
  it('tells a guide author how their guide’s prints fitted, once anyone has said', () => {
    expect(guideFitLine({ fitted: 12, fit_answers: 14 })).toBe('12 of 14 prints fitted')
    expect(guideFitLine({ fitted: 1, fit_answers: 1 })).toBe('1 of 1 print fitted')
    expect(guideFitLine({ fitted: 0, fit_answers: 0 })).toBeNull()
    expect(guideFitLine(undefined)).toBeNull()
  })
  it('gives an organisation Turnaround and Fit', () => {
    expect(orgPrintFacts(stats)).toEqual([
      { k: 'Turnaround', v: 'Median 3 days' },
      { k: 'Fit', v: '20 of 21 first time' },
    ])
  })
})

import { fitNotesLines, fitNotesProblem } from '@splat-connect/types'

describe('customization', () => {
  it('accepts the board’s options only', () => {
    expect(fitNotesProblem({ reach: '20–40 cm', tray: 'Not sure' })).toBeNull()
    expect(fitNotesProblem({ reach: '35 cm' })).toBe('Customization answers must be one of the options offered.')
    expect(fitNotesProblem({ shoe_size: '4' })).toBe('Customization answers must be one of the options offered.')
    expect(fitNotesProblem(['reach'])).toBe('Customization answers must be one of the options offered.')
  })
  it('reads back to the printer in the board’s order', () => {
    expect(fitNotesLines({ tray: '15 mm', reach: 'Under 20 cm' })).toEqual(['Reach from seated: Under 20 cm', 'Tray thickness: 15 mm'])
    expect(fitNotesLines(null)).toEqual([])
  })
})

describe('bedFits', () => {
  const bed = { bed_x: 220, bed_y: 180, bed_z: 250 }
  it('fits a part either way round on x/y', () => {
    expect(bedFits(bed, [{ size_x_mm: 170, size_y_mm: 210, size_z_mm: 40 }])).toBe(true)
  })
  it('does not tip a part over to fit z', () => {
    expect(bedFits(bed, [{ size_x_mm: 100, size_y_mm: 100, size_z_mm: 260 }])).toBe(false)
  })
  it('is decided by the largest part', () => {
    expect(bedFits(bed, [{ size_x_mm: 10, size_y_mm: 10, size_z_mm: 10 }, { size_x_mm: 230, size_y_mm: 190, size_z_mm: 10 }])).toBe(false)
  })
  it('hides nothing unless every part has its sizes', () => {
    expect(bedFits(bed, [{ size_x_mm: 900, size_y_mm: 900, size_z_mm: 900 }, { size_x_mm: null, size_y_mm: 5, size_z_mm: 5 }])).toBe(true)
    expect(bedFits(bed, [])).toBe(true)
  })
})
