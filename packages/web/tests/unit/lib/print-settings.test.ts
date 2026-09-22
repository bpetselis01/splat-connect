import { describe, it, expect } from 'vitest'
import {
  formatPrintMinutes,
  printSummary,
  printTimeLabel,
  filamentLabel,
  printFilesLine,
} from '@/lib/print-settings'

const body = { filename: 'switch-mount-body.stl', print_minutes: 100, filament_grams: 20, material: 'PETG' as const }
const clamp = { filename: 'switch-mount-clamp.stl', print_minutes: 90, filament_grams: 21, material: 'PETG' as const }
const blank = { filename: 'cradle-65mm.stl', print_minutes: null, filament_grams: null, material: null }

describe('formatPrintMinutes', () => {
  it('writes the board\'s "3 h 10 min" and drops the empty unit', () => {
    expect(formatPrintMinutes(190)).toBe('3 h 10 min')
    expect(formatPrintMinutes(45)).toBe('45 min')
    expect(formatPrintMinutes(120)).toBe('2 h')
  })
})

describe('printSummary', () => {
  it('sums the ticked parts, one copy each', () => {
    expect(printSummary([body, clamp])).toEqual({ minutes: 190, grams: 41, material: 'PETG' })
  })
  it('multiplies by quantity on a job', () => {
    expect(printSummary([{ ...body, quantity: 2 }]).minutes).toBe(200)
  })
  it('skips a blank part but is null when nothing is known', () => {
    expect(printSummary([body, blank]).minutes).toBe(100)
    expect(printSummary([blank])).toEqual({ minutes: null, grams: null, material: null })
    expect(printSummary([])).toEqual({ minutes: null, grams: null, material: null })
  })
  it('lists distinct materials once, in order', () => {
    expect(printSummary([body, { ...clamp, material: 'TPU' }, body]).material).toBe('PETG + TPU')
  })
})

describe('labels', () => {
  it('draw the tiles and a dash where the guide never said', () => {
    expect(printTimeLabel([body, clamp])).toBe('3 h 10 min')
    expect(filamentLabel([body, clamp])).toBe('41 g PETG')
    expect(printTimeLabel([blank])).toBe('—')
    expect(filamentLabel([blank])).toBe('—')
    expect(filamentLabel([{ ...body, material: null }])).toBe('20 g')
  })
})

describe('printFilesLine', () => {
  it('joins names and only writes a quantity above one', () => {
    expect(
      printFilesLine([
        { filename: 'grip-left.stl', quantity: 1 },
        { filename: 'grip-right.stl', quantity: 2 },
      ])
    ).toBe('grip-left.stl, grip-right.stl × 2')
  })
})
