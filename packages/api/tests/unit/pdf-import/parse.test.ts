import { describe, it, expect } from 'vitest'
import {
  parseGuide,
  splitQuantity,
  parseDuration,
  guessBuildMinutes,
  guessAges,
  guessDifficulty,
  guessKind,
  readPrintSettings,
  toCells,
  dropNoise,
  type TextItem,
} from '../../../src/pdf-import/parse.js'

/** A text run at (x, y); width approximated from the length, as pdf.js would report it. */
const t = (page: number, x: number, y: number, str: string, size = 11): TextItem => ({
  page,
  x,
  y,
  str,
  size,
  w: str.length * size * 0.5,
})

/** Lines stacked down the left margin, 16pt apart. */
function column(page: number, lines: (string | [string, number])[], top = 700, x = 72): TextItem[] {
  return lines.map((l, i) => {
    const [str, size] = typeof l === 'string' ? [l, 11] : l
    return t(page, x, top - i * 16, str, size)
  })
}

describe('splitQuantity', () => {
  it.each([
    ['2x Mono jack', 'Mono jack', 2],
    ['2 x Mono jack', 'Mono jack', 2],
    ['×3 M3 screws', 'M3 screws', 3],
    ['M3 screw ×4', 'M3 screw', 4],
    ['M3 screw (x4)', 'M3 screw', 4],
    ['Qty 2 Hex nut', 'Hex nut', 2],
    ['Hex nut - Qty: 6', 'Hex nut', 6],
    ['130 size DC motor', '130 size DC motor', 1],
    ['3D printed base', '3D printed base', 1],
  ])('%s', (text, name, quantity) => {
    expect(splitQuantity(text)).toEqual({ name, quantity })
  })
})

describe('parseDuration', () => {
  it.each([
    ['1h 09m', 69],
    ['1 h 09 m', 69],
    ['0:46', 46],
    ['2 hours', 120],
    ['1.5 h', 90],
    ['45 min', 45],
    ['101', 101],
  ])('%s -> %i', (s, n) => expect(parseDuration(s)).toBe(n))

  it('does not read a bare number as a duration when told not to', () => {
    expect(parseDuration('101', null)).toBeNull()
  })
})

describe('guessBuildMinutes', () => {
  it('takes the upper end of a range and snaps to the editor options', () => {
    expect(guessBuildMinutes('Allow about 30–45 min assembly.')).toBe(45)
    expect(guessBuildMinutes('Assembly time: 25 minutes')).toBe(30)
    expect(guessBuildMinutes('Build time 1-2 hours')).toBe(120)
    expect(guessBuildMinutes('Takes 3 hours to build')).toBe(180)
  })
  it('ignores print time', () => {
    expect(guessBuildMinutes('Print time 1 h 09 m')).toBeNull()
  })
})

describe('guessAges / guessDifficulty', () => {
  it('reads age ranges and open ends', () => {
    expect(guessAges('Suitable for ages 3–7.')).toEqual({ age_min: 3, age_max: 7 })
    expect(guessAges('Ages 5+')).toEqual({ age_min: 5, age_max: null })
    expect(guessAges('Age 40 and up')).toEqual({ age_min: 18, age_max: null })
    expect(guessAges('No ages here')).toEqual({ age_min: null, age_max: null })
  })
  it('maps difficulty words onto easy / medium / hard', () => {
    expect(guessDifficulty('Difficulty: Beginner')).toBe('easy')
    expect(guessDifficulty('Skill level - intermediate')).toBe('medium')
    expect(guessDifficulty('Difficulty level: Advanced')).toBe('hard')
    expect(guessDifficulty('This is not difficult')).toBeNull()
  })
})

describe('guessKind', () => {
  it('trusts the title first', () => {
    expect(guessKind('Switch Adapted Penguin Toy', 'switch switch switch')).toEqual({ kind: 'toy_adaptation', confidence: 'high' })
    expect(guessKind('Low Profile Switch', 'toy')).toEqual({ kind: 'assistive_tech', confidence: 'high' })
    expect(guessKind('Wheelchair Tray Mount', '')).toEqual({ kind: 'assistive_tech', confidence: 'high' })
  })
  it('falls back to counting words in the text', () => {
    expect(guessKind('Rumble Plate', 'adapt the toy so the toy works').kind).toBe('toy_adaptation')
    expect(guessKind('Rumble Plate', 'press the switch; mount the switch').kind).toBe('assistive_tech')
    expect(guessKind('Thing', 'nothing to go on')).toEqual({ kind: 'toy_adaptation', confidence: 'none' })
  })
  it('is stable across calls (no global-regex state)', () => {
    expect(guessKind('Toy', '').kind).toBe('toy_adaptation')
    expect(guessKind('Toy', '').kind).toBe('toy_adaptation')
  })
})

describe('readPrintSettings', () => {
  it('reads free-text settings', () => {
    const cells = toCells(
      column(1, ['Layer Height 0.2 mm', 'Infill 20%', 'Supports: None', 'Print time 1 h 09 m', 'Filament 8 g', 'Material: PETG'])
    )
    expect(readPrintSettings(cells)).toEqual({
      layer_height_mm: 0.2,
      infill_percent: 20,
      supports: false,
      material: 'PETG',
      print_minutes: 69,
      filament_grams: 8,
    })
  })
  it('reads prose ("a layer height of 0.3 mm and 20% infill")', () => {
    const cells = toCells(column(1, ['For an ideal print time, a layer height of 0.3 mm and 20% infill is recommended.']))
    expect(readPrintSettings(cells)).toEqual({ layer_height_mm: 0.3, infill_percent: 20 })
  })
  it('reads a value to the right of its header, taking the largest of several columns', () => {
    const cells = toCells([
      t(1, 77, 627, 'Total Print Time (min)'),
      t(1, 264, 627, '170'),
      t(1, 371, 627, '200'),
      t(1, 482, 627, '240'),
    ])
    expect(readPrintSettings(cells).print_minutes).toBe(240)
  })
  it('reads values below table headers, and supports from any Y', () => {
    const cells = toCells([
      t(1, 300, 369, 'Infill'),
      t(1, 355, 369, 'Support(Y/N)'),
      t(1, 445, 369, 'Layer Height/'),
      t(1, 305, 315, '20'),
      t(1, 382, 315, 'N'),
      t(1, 460, 315, '0.2/0.4'),
      t(1, 305, 295, '20'),
      t(1, 383, 295, 'Y'),
      t(1, 460, 295, '0.2/0.4'),
    ])
    expect(readPrintSettings(cells)).toEqual({ infill_percent: 20, supports: true, layer_height_mm: 0.2 })
  })
})

describe('toCells / dropNoise', () => {
  it('keeps table columns apart but joins a bullet to its text', () => {
    const cells = toCells([t(1, 90, 500, '•'), t(1, 108, 500, 'Soldering Iron'), t(1, 300, 500, 'Required')])
    expect(cells.map((c) => c.text)).toEqual(['• Soldering Iron', 'Required'])
  })
  it('does not join a photo callout number to the line beside it', () => {
    const cells = toCells([t(1, 430, 605, '1', 12), t(1, 448, 605, '1x Cool Beats')])
    expect(cells.map((c) => c.text)).toEqual(['1', '1x Cool Beats'])
  })
  it('drops running headers, licence lines, TOC rows and callout numbers, but not step numbers', () => {
    const items = [1, 2, 3].flatMap((p) => [
      t(p, 72, 729, 'Widget', 18),
      t(p, 72, 47, '© 2022 by Someone. This work is licensed under CC BY-SA'),
      t(p, 504, 37, `Page ${p} of 3`),
      t(p, 72, 644, `Step ${p}`, 13),
      t(p, 200, 400, String(p)),
    ])
    items.push(t(1, 72, 600, 'Step 01: Remove supports .............. 9'))
    const kept = dropNoise(toCells(items), 3).map((c) => c.text)
    expect(kept).toEqual(['Step 1', 'Step 2', 'Step 3'])
  })
})

describe('parseGuide', () => {
  it('reads a guide with "Step N" headings, colon titles and a numbered BOM', () => {
    const items = [
      t(1, 72, 740, 'Switch Adapted Robot Dog', 20),
      ...column(1, [['Overview', 14], 'This guide shows how to adapt a robot dog so a child can drive it with a switch. It takes about 30-45 min of assembly.'], 700),
      ...column(1, [['Bill of Materials', 14], '1. 1x Robot dog', '2. 2x AA battery', '3. 3.5 mm mono jack', '4. Hookup wire', 'about 10 cm'], 640),
      ...column(1, [['Tools Required', 14], '• Soldering iron', '• Wire strippers'], 520),
      ...column(2, [['Assembly', 14], ['Step 1', 13], 'Opening the case:', 'Remove the four screws.', ['Step 2', 13], 'Solder the jack to the', 'motor leads.'], 700),
    ]
    const d = parseGuide(items, 2)
    expect(d.title).toBe('Switch Adapted Robot Dog')
    expect(d.kind).toBe('toy_adaptation')
    expect(d.summary).toMatch(/^This guide shows how to adapt a robot dog/)
    expect(d.build_minutes).toBe(45)
    expect(d.parts).toEqual([
      { name: 'Robot dog', quantity: 1 },
      { name: 'AA battery', quantity: 2 },
      { name: '3.5 mm mono jack', quantity: 1 },
      { name: 'Hookup wire about 10 cm', quantity: 1 },
    ])
    expect(d.tools).toEqual([{ name: 'Soldering iron' }, { name: 'Wire strippers' }])
    expect(d.steps).toEqual([
      { title: 'Opening the case', body: 'Remove the four screws.' },
      { body: 'Solder the jack to the motor leads.' },
    ])
    expect(d.confidence).toMatchObject({ title: 'high', summary: 'high', parts: 'high', tools: 'high', steps: 'high' })
  })

  it('reads "Step 01: Title" lines and ignores the table of contents', () => {
    const items = [
      t(1, 72, 740, 'Light Switch', 18),
      ...column(1, [['Contents', 14], 'Step 01: Trim leads ........ 9', 'Step 02: Solder ........ 9'], 700),
      ...column(2, ['Step 01: Trim leads', 'Use flush cutters on the leads.', 'Step 02: Solder', 'Solder both joints.'], 700),
    ]
    const d = parseGuide(items, 2)
    expect(d.steps).toEqual([
      { title: 'Trim leads', body: 'Use flush cutters on the leads.' },
      { title: 'Solder', body: 'Solder both joints.' },
    ])
  })

  it('pairs big "01." markers with text in two columns, and reports the ones with no text', () => {
    const items = [
      t(1, 72, 740, 'Battery Interrupt', 26),
      t(1, 77, 538, '01.', 28),
      t(1, 115, 545, 'Cut the copper tape to size.'),
      t(1, 311, 536, '02.', 28),
      t(1, 351, 549, 'Fold the tape over'),
      t(1, 351, 535, 'the card.'),
      t(1, 77, 397, '03.', 28),
      t(1, 115, 409, 'FRONT'),
    ]
    const d = parseGuide(items, 1)
    expect(d.steps).toEqual([{ body: 'Cut the copper tape to size.' }, { body: 'Fold the tape over the card.' }])
    expect(d.warnings.some((w) => /^Step 3 had no readable text/.test(w))).toBe(true)
  })

  it('reads an ID-coded component table ("A01 | Tactile switch | QTY: 1")', () => {
    const items = [
      t(1, 72, 740, 'Light Touch Switch', 18),
      t(1, 72, 673, 'Maker Component List', 14),
      t(1, 78, 642, 'A01'),
      t(1, 122, 642, 'Tactile'),
      t(1, 122, 628, 'switch'),
      t(1, 186, 642, 'QTY: 1'),
      t(1, 230, 642, 'A02'),
      t(1, 275, 642, 'Mono cable'),
      t(1, 347, 642, 'QTY: 2'),
    ]
    expect(parseGuide(items, 1).parts).toEqual([
      { name: 'Tactile switch', quantity: 1 },
      { name: 'Mono cable', quantity: 2 },
    ])
  })

  it('does not treat "Components" in a table header row as a parts heading', () => {
    const items = [
      t(1, 72, 740, 'Book Holder', 18),
      t(1, 72, 670, '3D Printing Summary', 14),
      t(1, 105, 641, 'Configuration'),
      t(1, 314, 641, 'Components'),
      t(1, 78, 613, 'Book Holder'),
    ]
    expect(parseGuide(items, 1).parts).toEqual([])
  })

  it('falls back to a numbered list under an instructions heading', () => {
    const items = [
      t(1, 72, 740, 'Tray Mount', 18),
      ...column(1, [['Instructions', 14], '1. Print both halves.', '2. Press the halves together until', 'they click.'], 700),
    ]
    const d = parseGuide(items, 1)
    expect(d.steps).toEqual([{ body: 'Print both halves.' }, { body: 'Press the halves together until they click.' }])
    expect(d.confidence.steps).toBe('low')
  })

  it('cuts a step body at 2000 characters and says so', () => {
    const long = 'Solder the joint carefully. '.repeat(100)
    const items = [t(1, 72, 740, 'Big Guide', 18), ...column(1, ['Step 1', long, 'Step 2', 'Done.'], 700)]
    const d = parseGuide(items, 1)
    expect(d.steps[0].body.length).toBeLessThanOrEqual(2000)
    expect(d.warnings).toContain('Step 1 was longer than 2000 characters and was cut short.')
  })

  it('says so when the PDF has no text layer', () => {
    const d = parseGuide([], 3)
    expect(d.title).toBeNull()
    expect(d.warnings[0]).toMatch(/no readable text/)
    expect(d.page_count).toBe(3)
  })

  it('caps the summary at 500 characters on a sentence boundary', () => {
    const para = 'This switch helps a child play independently with the toy they love most. '.repeat(10)
    const d = parseGuide([t(1, 72, 740, 'Switch', 18), ...column(1, [['Overview', 14], para], 700)], 1)
    expect(d.summary!.length).toBeLessThanOrEqual(500)
    expect(d.summary!.endsWith('.')).toBe(true)
  })
})
