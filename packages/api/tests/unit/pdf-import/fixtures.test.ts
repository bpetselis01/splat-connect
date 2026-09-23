// Golden tests on real Makers Making Change guides (see tests/fixtures/pdf-import/README.md).
// These run the whole path — pdf.js text extraction and the parser — on the
// files a contributor would actually upload.
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { importPdf } from '../../../src/pdf-import/extract.js'

const fixture = (name: string) =>
  new Uint8Array(readFileSync(new URL(`../../fixtures/pdf-import/${name}`, import.meta.url)))

describe('Low Profile Switch assembly guide', async () => {
  const draft = await importPdf(fixture('Low_Profile_Switch_Assembly_Guide_v1.0.pdf'))

  it('reads the title, not the running "ASSEMBLY GUIDE" header', () => {
    expect(draft.title).toBe('Low Profile Switch')
    expect(draft.page_count).toBe(3)
  })

  it('reads the bill of materials with quantities', () => {
    expect(draft.parts).toEqual([
      { name: '3D printed switch top', quantity: 1 },
      { name: '3D printed switch bottom', quantity: 1 },
      { name: '3.5 mm mono cable', quantity: 1 },
      { name: '12mm tactile switch', quantity: 1 },
    ])
  })

  it('reads the tools, including protective equipment', () => {
    expect(draft.tools.map((t) => t.name)).toEqual([
      'Soldering Iron and Solder',
      'Wire Strippers / Wire Cutters',
      'Hot Glue Gun and Glue',
      'Safety Glasses',
    ])
  })

  it('pairs each of the 16 big step numbers with the text beside it, across two columns', () => {
    expect(draft.steps).toHaveLength(16)
    expect(draft.steps[0].body).toBe('Cut off the two leads on one side flush.')
    expect(draft.steps[1].body).toBe('Bend the two remaining leads to make a 90° angle with the switch.')
    expect(draft.steps[9].body).toMatch(/^IMPORTANT: After soldering the two leads/)
    expect(draft.steps[15].body).toMatch(/can rotate freely without friction\.$/)
  })

  it('guesses assistive tech from a switch in the title, and says photos are not copied', () => {
    expect(draft.kind).toBe('assistive_tech')
    expect(draft.warnings).toContain('Photos and diagrams inside the PDF are not copied — add them to the guide yourself.')
    expect(draft.confidence).toMatchObject({ parts: 'high', tools: 'high', steps: 'high' })
  })
})

describe('Low Profile Switch 3D printing guide', async () => {
  const draft = await importPdf(fixture('Low_Profile_Switch_3D_Printing_Guide_v1.0.pdf'))

  it('reads the print summary and settings tables', () => {
    expect(draft.print_settings).toEqual({
      layer_height_mm: 0.2,
      infill_percent: 20,
      supports: false,
      print_minutes: 101,
      filament_grams: 23,
    })
    expect(draft.confidence.print_settings).toBe('high')
  })

  it('finds no parts or steps, and says so', () => {
    expect(draft.parts).toEqual([])
    expect(draft.steps).toEqual([])
    expect(draft.warnings).toContain('No numbered steps found.')
  })
})

describe('One Handed Book Holder user guide', async () => {
  const draft = await importPdf(fixture('One_Handed_Book_Holder_User_Guide.pdf'))

  it('takes the first descriptive paragraph as the summary', () => {
    expect(draft.title).toBe('One Handed Book Holder')
    expect(draft.summary).toMatch(/^The One Handed Book Holder is an inexpensive 3D printed device/)
    expect(draft.summary!.length).toBeLessThanOrEqual(500)
    expect(draft.kind).toBe('assistive_tech')
  })
})

describe('input that is not a guide', () => {
  it('rejects bytes that are not a PDF', async () => {
    await expect(importPdf(new TextEncoder().encode('not a pdf'))).rejects.toThrow()
  })
})
