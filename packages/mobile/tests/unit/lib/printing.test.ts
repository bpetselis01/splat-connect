// packages/mobile/tests/unit/lib/printing.test.ts
//
// The rules the printing screens share: picks cap at three, the group copy on
// both sides of a request, which card the job page shows, and which of an
// organisation's machines the picker preselects.
import type { PrinterWithOwner } from '@splat-connect/types'
import {
  askedLabel,
  bestMachine,
  jobState,
  machineFit,
  othersLabel,
  partsMeta,
  pickButtonLabel,
  railIndex,
  togglePick,
} from '../../../lib/printing'

const printer = (over: Partial<PrinterWithOwner>): PrinterWithOwner => ({
  id: 'p',
  owner_id: null,
  owner_org_id: 'org',
  name: 'Bench',
  materials: ['PETG', 'PLA'],
  bed_x: 220,
  bed_y: 220,
  bed_z: 220,
  suburb: null,
  state: null,
  accepting: true,
  capacity: 2,
  notes: null,
  filament_cents_per_g: null,
  rate_note: null,
  created_at: '',
  updated_at: '',
  owner_name: null,
  org_name: 'Library',
  open_jobs: 0,
  ...over,
})

describe('picking printers', () => {
  it('adds up to three, refuses a fourth, and unpicks', () => {
    let picks: string[] = []
    for (const id of ['a', 'b', 'c', 'd']) picks = togglePick(picks, id)
    expect(picks).toEqual(['a', 'b', 'c'])
    expect(togglePick(picks, 'b')).toEqual(['a', 'c'])
  })

  it('counts picks on the sticky button', () => {
    expect(pickButtonLabel(0)).toBe('Pick a printer to continue')
    expect(pickButtonLabel(1)).toBe('Ask 1 printer')
    expect(pickButtonLabel(3)).toBe('Ask 3 printers')
  })
})

describe('group copy', () => {
  it('tells the family how many printers they asked', () => {
    expect(askedLabel(2)).toBe('Asked 2 printers.')
    expect(askedLabel(1)).toBe('Asked 1 printer.')
  })

  it('tells a printer how many others were asked', () => {
    expect(othersLabel(1)).toBe('Only you were asked')
    expect(othersLabel(2)).toBe('Also asked 1 other')
    expect(othersLabel(3)).toBe('Also asked 2 others')
  })
})

describe('job state and rail', () => {
  const tx = (status: string, printing_started_at: string | null = null, ready_at: string | null = null) =>
    ({ status, printing_started_at, ready_at }) as Parameters<typeof jobState>[0]

  it.each([
    [tx('requested'), 'asked', 0],
    [tx('accepted'), 'accepted', 1],
    [tx('accepted', 'x'), 'printing', 2],
    [tx('accepted', 'x', 'y'), 'ready', 3],
    [tx('completed', 'x', 'y'), 'collected', 4],
    // Ended early: its own card, and the rail stays at the start.
    [tx('rejected'), 'declined', 0],
    [tx('withdrawn'), 'withdrawn', 0],
  ])('%o is %s at dot %i', (row, state, dot) => {
    expect(jobState(row)).toBe(state)
    expect(railIndex(jobState(row))).toBe(dot)
  })
})

describe('machine fit', () => {
  it('fits a machine with the material and a free slot', () => {
    expect(machineFit(printer({}), ['PETG']).ok).toBe(true)
  })

  it('lets a missing material through as "accept anyway", but blocks a full or paused machine', () => {
    expect(machineFit(printer({ materials: ['PLA'] }), ['PETG'])).toMatchObject({ ok: false, blocked: false, why: 'No PETG loaded' })
    expect(machineFit(printer({ open_jobs: 2 }), ['PETG'])).toMatchObject({ ok: false, blocked: true })
    expect(machineFit(printer({ accepting: false }), ['PETG'])).toMatchObject({ ok: false, blocked: true })
  })

  it('preselects a fit, then the most free slots, then the biggest bed', () => {
    const full = printer({ id: 'full', open_jobs: 2, bed_x: 300 })
    const pla = printer({ id: 'pla', materials: ['PLA'], capacity: 5 })
    const small = printer({ id: 'small', bed_x: 180 })
    const big = printer({ id: 'big', bed_x: 256 })
    const roomy = printer({ id: 'roomy', capacity: 3, bed_x: 180 })
    expect(bestMachine([full, pla, small, big], ['PETG'])?.id).toBe('big')
    expect(bestMachine([small, roomy], ['PETG'])?.id).toBe('roomy')
    // Nothing fits: a machine that can still take it beats one that cannot.
    expect(bestMachine([full, pla], ['PETG'])?.id).toBe('pla')
  })
})

it('sums the parts the guide gave figures for, and leaves out what it did not', () => {
  expect(
    partsMeta([
      { print_minutes: 100, filament_grams: 20, material: 'PETG' },
      { print_minutes: 90, filament_grams: 22, material: 'PETG' },
    ])
  ).toBe('about 3 h 10 · ~42 g PETG')
  expect(partsMeta([{ print_minutes: null, filament_grams: null, material: null }])).toBe('')
})
