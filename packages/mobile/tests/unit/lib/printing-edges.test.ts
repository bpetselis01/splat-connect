// Outlier inputs for the printing rules: money, quantities, empty lists, the
// shapes a half-filled printer or job row can take.
import type { PrinterWithOwner } from '@splat-connect/types'
import { costRange, dollarsToCents, formatCents, printCostCents, statsLine } from '@splat-connect/types'
import {
  answerByLabel,
  availability,
  bestMachine,
  formatMinutes,
  isLive,
  isOpen,
  JOB_LABEL,
  JOB_TONE,
  jobState,
  machineFit,
  othersLabel,
  partMaterials,
  partsMeta,
  pickButtonLabel,
  railIndex,
  RAIL,
  togglePick,
  type JobState,
} from '../../../lib/printing'

const printer = (over: Partial<PrinterWithOwner> = {}): PrinterWithOwner =>
  ({
    id: 'p',
    owner_id: null,
    owner_org_id: 'org',
    name: 'Bench',
    materials: ['PETG'],
    bed_x: 220,
    bed_y: 220,
    bed_z: 220,
    accepting: true,
    capacity: 2,
    open_jobs: 0,
    ...over,
  }) as PrinterWithOwner

const DAY = 864e5

describe('the filament rate a printer types (dollars per gram)', () => {
  it.each([
    ['0.12', 12],
    ['0.1', 10],
    ['12', 1200],
    ['12.10', 1210],
    ['$0.12', 12],
    [' 0.12 ', 12],
    ['0', 0],
    ['0.00', 0],
    ['1000', 100000],
  ])('reads %p as %p cents', (typed, cents) => {
    expect(dollarsToCents(typed)).toBe(cents)
  })

  it.each([
    ['empty', ''],
    ['whitespace', '   '],
    ['negative', '-1'],
    ['three decimals', '0.125'],
    ['exponent', '1e3'],
    ['NaN', 'NaN'],
    ['Infinity', 'Infinity'],
    ['comma decimal', '0,12'],
    ['no leading digit', '.5'],
    ['units', '12c'],
    ['two numbers', '1 2'],
    ['emoji', '💰'],
    ['more than nine digits', '1000000000'],
    ['an injected tag', '<b>1</b>'],
  ])('refuses %s', (_label, typed) => {
    expect(dollarsToCents(typed)).toBeNull()
  })

  it('never loses the cent that 12.10 * 100 would', () => {
    expect(dollarsToCents('12.10')).toBe(1210)
    expect(dollarsToCents('1.15')).toBe(115)
    expect(dollarsToCents('0.29')).toBe(29)
  })
})

describe('what a family is asked to cover', () => {
  const part = (grams: number | null, quantity?: number) => ({ filament_grams: grams, quantity })

  it('adds grams x quantity x rate across parts', () => {
    expect(printCostCents([part(10, 2), part(4)], 10)).toBe(240)
  })

  it('says nothing for a zero rate rather than $0.00', () => {
    expect(printCostCents([part(10)], 0)).toBeNull()
  })

  it('says nothing for a free printer (null rate), no parts, or a part with no grams', () => {
    expect(printCostCents([part(10)], null)).toBeNull()
    expect(printCostCents([], 10)).toBeNull()
    expect(printCostCents([part(10), part(null)], 10)).toBeNull()
  })

  it('says nothing for a part that weighs nothing', () => {
    expect(printCostCents([part(0)], 10)).toBeNull()
  })

  it('stays exact at the largest quantity and rate the form allows', () => {
    // 20 of a 250 g part at the API's $1000/g ceiling.
    expect(printCostCents([part(250, 20)], 100_000)).toBe(500_000_000)
    expect(formatCents(500_000_000)).toBe('$5,000,000.00')
  })

  it('shows one figure when every printer agrees and a range when they differ', () => {
    expect(costRange([140, 140])).toEqual([140, 140])
    expect(costRange([280, 140])).toEqual([140, 280])
  })

  it('offers no range when any picked printer has no estimate, or none were picked', () => {
    expect(costRange([140, null])).toBeNull()
    expect(costRange([])).toBeNull()
    expect(costRange([null])).toBeNull()
  })

  it('formats whole and part-dollar amounts the same way every screen does', () => {
    expect(formatCents(0)).toBe('$0.00')
    expect(formatCents(5)).toBe('$0.05')
    expect(formatCents(100)).toBe('$1.00')
    expect(formatCents(123_456)).toBe('$1,234.56')
  })
})

describe('minutes', () => {
  it.each([
    [0, '0 min'],
    [1, '1 min'],
    [59, '59 min'],
    [60, '1 h'],
    [61, '1 h 1'],
    [190, '3 h 10'],
    [1440, '24 h'],
    [6000, '100 h'],
  ])('writes %i as %p', (minutes, text) => {
    expect(formatMinutes(minutes)).toBe(text)
  })
})

describe('part summaries', () => {
  it('is empty for no parts', () => {
    expect(partsMeta([])).toBe('')
    expect(partMaterials([])).toEqual([])
  })

  it('multiplies by quantity and lists each material once, in the order first seen', () => {
    const parts = [
      { print_minutes: 30, filament_grams: 5, material: 'PETG', quantity: 3 },
      { print_minutes: 10, filament_grams: 1, material: 'PLA', quantity: 1 },
      { print_minutes: 10, filament_grams: 1, material: 'PETG', quantity: 1 },
    ] as Parameters<typeof partsMeta>[0]
    expect(partMaterials(parts)).toEqual(['PETG', 'PLA'])
    expect(partsMeta(parts)).toBe('about 1 h 50 · ~17 g PETG + PLA')
  })

  it('names only the material when the guide gave no figures', () => {
    expect(partsMeta([{ print_minutes: null, filament_grams: null, material: 'TPU' }] as Parameters<typeof partsMeta>[0])).toBe('TPU')
  })

  it('names nothing when the guide gave nothing', () => {
    expect(partsMeta([{ print_minutes: null, filament_grams: null, material: null }] as Parameters<typeof partsMeta>[0])).toBe('')
  })
})

describe('picks', () => {
  it('ignores a repeat tap on a printer already picked three deep by unpicking just that one', () => {
    expect(togglePick(['a', 'b', 'c'], 'b')).toEqual(['a', 'c'])
  })

  it('keeps the first three when a fourth is tapped twice', () => {
    const full = ['a', 'b', 'c']
    expect(togglePick(togglePick(full, 'd'), 'd')).toEqual(full)
  })

  it('does not mutate the list it was given', () => {
    const picks = ['a']
    togglePick(picks, 'b')
    togglePick(picks, 'a')
    expect(picks).toEqual(['a'])
  })

  it('labels a button for none, one, and many', () => {
    expect(pickButtonLabel(0)).toBe('Pick a printer to continue')
    expect(pickButtonLabel(1)).toBe('Ask 1 printer')
    expect(pickButtonLabel(3)).toBe('Ask 3 printers')
  })

  it('tells a lone printer nobody else was asked, even for a group size of zero', () => {
    expect(othersLabel(1)).toBe('Only you were asked')
    expect(othersLabel(0)).toBe('Only you were asked')
    expect(othersLabel(2)).toBe('Also asked 1 other')
    expect(othersLabel(3)).toBe('Also asked 2 others')
  })
})

describe('availability pill', () => {
  it('reads Paused before Full when a paused printer is also full', () => {
    expect(availability(printer({ accepting: false, open_jobs: 5, capacity: 2 })).label).toBe('Paused')
  })

  it('reads Full at capacity and over it', () => {
    expect(availability(printer({ open_jobs: 2, capacity: 2 })).label).toBe('Full')
    expect(availability(printer({ open_jobs: 3, capacity: 2 })).label).toBe('Full')
  })

  it('treats a printer with no capacity as full and closed', () => {
    const p = printer({ capacity: 0 })
    expect(availability(p).label).toBe('Full')
    expect(isOpen(p)).toBe(false)
  })

  it('counts the queue', () => {
    expect(availability(printer({ open_jobs: 1 }))).toEqual({ label: '1 in queue', tone: 'requested' })
    expect(availability(printer({ open_jobs: 0 }))).toEqual({ label: 'No queue', tone: 'completed' })
  })

  it('needs both willingness and a free slot to be open', () => {
    expect(isOpen(printer({ accepting: false }))).toBe(false)
    expect(isOpen(printer({ open_jobs: 2 }))).toBe(false)
    expect(isOpen(printer({ open_jobs: 1 }))).toBe(true)
  })
})

describe('machine fit', () => {
  it('fits a job that names no material', () => {
    expect(machineFit(printer(), []).ok).toBe(true)
  })

  it('names every missing material', () => {
    expect(machineFit(printer({ materials: ['PLA'] }), ['PETG', 'TPU']).why).toBe('No PETG or TPU loaded')
  })

  it('matches materials exactly, not by case', () => {
    expect(machineFit(printer({ materials: ['PETG'] }), ['petg']).ok).toBe(false)
  })

  it('blocks a machine over capacity, not only one at it', () => {
    expect(machineFit(printer({ open_jobs: 9, capacity: 2 }), [])).toEqual({ ok: false, blocked: true, why: 'No free slot' })
  })

  it('blocks a paused machine before it mentions materials', () => {
    expect(machineFit(printer({ accepting: false, materials: [] }), ['PETG']).why).toBe('Paused')
  })

  it('preselects nothing from nothing', () => {
    expect(bestMachine([], ['PETG'])).toBeUndefined()
  })

  it('still preselects a blocked machine when it is all there is', () => {
    const only = printer({ id: 'only', accepting: false })
    expect(bestMachine([only], [])).toBe(only)
  })

  it('prefers a machine that needs a change over one that is blocked', () => {
    const blocked = printer({ id: 'blocked', open_jobs: 2 })
    const missing = printer({ id: 'missing', materials: ['PLA'] })
    expect(bestMachine([blocked, missing], ['PETG'])?.id).toBe('missing')
  })

  it('does not reorder the list it was given', () => {
    const list = [printer({ id: 'a', bed_x: 100 }), printer({ id: 'b', bed_x: 300 })]
    bestMachine(list, [])
    expect(list.map((p) => p.id)).toEqual(['a', 'b'])
  })
})

describe('job states', () => {
  const tx = (over: object = {}) => ({
    status: 'requested',
    type: 'print',
    printing_started_at: null,
    ready_at: null,
    created_at: new Date().toISOString(),
    ...over,
  }) as Parameters<typeof jobState>[0]

  it('has a label, a tone and a rail position for every state', () => {
    const states: JobState[] = ['asked', 'accepted', 'printing', 'ready', 'collected', 'declined', 'withdrawn', 'expired']
    for (const s of states) {
      expect(JOB_LABEL[s]).toBeTruthy()
      expect(JOB_TONE[s]).toBeTruthy()
      expect(railIndex(s)).toBeLessThan(RAIL.length)
    }
  })

  it('reads a ready photo-less job by its timestamps, not its status', () => {
    expect(jobState(tx({ status: 'accepted', printing_started_at: 'x' }))).toBe('printing')
    expect(jobState(tx({ status: 'accepted', printing_started_at: 'x', ready_at: 'y' }))).toBe('ready')
  })

  it('does not call a print that finished printing but was rejected anything but declined', () => {
    expect(jobState(tx({ status: 'rejected', printing_started_at: 'x', ready_at: 'y' }))).toBe('declined')
  })

  it('does not expire a donation request after seven days', () => {
    expect(jobState(tx({ type: 'donation', created_at: new Date(Date.now() - 30 * DAY).toISOString() }))).toBe('asked')
  })

  it('does not expire an accepted print however old', () => {
    expect(jobState(tx({ status: 'accepted', created_at: new Date(Date.now() - 30 * DAY).toISOString() }))).toBe('accepted')
  })

  it('expires on the eighth day, not the seventh', () => {
    expect(jobState(tx({ created_at: new Date(Date.now() - 6.9 * DAY).toISOString() }))).toBe('asked')
    expect(jobState(tx({ created_at: new Date(Date.now() - 7.1 * DAY).toISOString() }))).toBe('expired')
  })

  it('keeps a request with no created_at asked rather than expiring it', () => {
    expect(jobState(tx({ created_at: null }))).toBe('asked')
  })

  it('counts requested and accepted as live and nothing else, an expired request not at all', () => {
    expect(isLive(tx({ status: 'requested' }))).toBe(true)
    expect(isLive(tx({ status: 'accepted' }))).toBe(true)
    for (const status of ['completed', 'rejected', 'withdrawn']) expect(isLive(tx({ status }))).toBe(false)
    expect(isLive(tx({ created_at: new Date(Date.now() - 8 * DAY).toISOString() }))).toBe(false)
  })

  it('writes the answer-by day seven days after the request, across a month end', () => {
    expect(answerByLabel('2026-01-28T12:00:00.000Z')).toMatch(/^\d{1,2} Feb$/)
  })
})

describe('printer stats line', () => {
  it('is blank for no record, and for none completed', () => {
    expect(statsLine(null)).toBeNull()
    expect(statsLine(undefined)).toBeNull()
    expect(statsLine({ jobs: 0, median_days: null, fitted: 0, fit_answers: 0, colours: [] })).toBeNull()
  })

  it('singularises one job and one day, and drops the turnaround when unknown', () => {
    expect(statsLine({ jobs: 1, median_days: 1, fitted: 0, fit_answers: 0, colours: [] })).toBe('1 job · ~1 day')
    expect(statsLine({ jobs: 5, median_days: null, fitted: 0, fit_answers: 0, colours: [] })).toBe('5 jobs')
  })
})
