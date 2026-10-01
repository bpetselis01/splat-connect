import { describe, it, expect } from 'vitest'
import { formatPrintMinutes, printSettingRows, printSettingsLine, checkedOn, partsTotalCents, realignCaptions } from '@splat-connect/types'

describe('partsTotalCents', () => {
  it('sums the required parts once every one has a price', () => {
    expect(partsTotalCents([{ is_optional: false, price_cents: 600 }, { is_optional: false, price_cents: 450 }, { is_optional: true, price_cents: null }])).toBe(1050)
  })
  it('shows no total while a required part is unpriced', () => {
    expect(partsTotalCents([{ is_optional: false, price_cents: 600 }, { is_optional: false, price_cents: null }])).toBeNull()
    expect(partsTotalCents([{ is_optional: false }])).toBeNull()
  })
  it('shows no total for a list with nothing required', () => {
    expect(partsTotalCents([])).toBeNull()
    expect(partsTotalCents([{ is_optional: true, price_cents: 100 }])).toBeNull()
  })
  it('counts a free part as priced', () => {
    expect(partsTotalCents([{ is_optional: false, price_cents: 0 }])).toBe(0)
  })
})

describe('checkedOn', () => {
  it('writes the date the board way, without shifting a day', () => {
    expect(checkedOn('2026-08-02')).toBe('2 Aug 2026')
  })
})

describe('realignCaptions', () => {
  it('moves each caption with its photo', () => {
    expect(realignCaptions(['a', 'b', 'c'], ['A', null, 'C'], ['c', 'a', 'b'])).toEqual(['C', 'A'])
  })
  it('drops a removed photo’s caption and gives a new photo none', () => {
    expect(realignCaptions(['a', 'b'], ['A', 'B'], ['b', 'n'])).toEqual(['B'])
  })
  it('never returns more captions than photos', () => {
    expect(realignCaptions(['a'], ['A', 'stray'], [])).toEqual([])
  })
})

describe('printSettingRows', () => {
  it('lists the settings a guide has, in the board’s words', () => {
    expect(printSettingRows({ layer_height_mm: 0.2, infill_percent: 25, material: 'PETG', print_minutes: 190 })).toEqual([
      { k: 'Layer height', v: '0.2 mm' },
      { k: 'Infill', v: '25 %' },
      { k: 'Material', v: 'PETG' },
      { k: 'Print time', v: '3 h 10' },
    ])
    expect(printSettingRows({ infill_percent: 0 })).toEqual([{ k: 'Infill', v: '0 %' }])
    expect(printSettingRows({})).toEqual([])
  })
  it('joins the slicer settings into one line for a print job', () => {
    expect(printSettingsLine({ layer_height_mm: 0.2, infill_percent: 25, material: 'PETG', print_minutes: 40 })).toBe('0.2 mm · 25 % · PETG')
  })
  it('writes short and whole-hour times plainly', () => {
    expect(formatPrintMinutes(40)).toBe('40 min')
    expect(formatPrintMinutes(120)).toBe('2 h')
  })
})
