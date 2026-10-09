import { reviewLead, reviewRows } from '../../../lib/review-checklist'

const base = {
  description: 'An off-the-shelf bubble machine.',
  kind: 'toy_adaptation',
  tutorial_pdf_url: 't/tutorial.pdf',
  safety_declared_at: '2026-09-01T00:00:00Z',
  parts: [{ is_optional: false }, { is_optional: false }, { is_optional: false }],
  tools: [{ is_optional: true }],
  stl_files: [],
  steps: [{ photo_url: 'a' }, { photo_url: 'b' }],
}

it('reads each section the board lists', () => {
  expect(reviewRows(base as never)).toEqual([
    { title: 'Summary', meta: 'Complete', ok: true },
    { title: 'Guide content', meta: '2 steps, all photographed', ok: true },
    { title: 'Parts', meta: '3 parts, 3 without a price', ok: true },
    { title: 'Tools', meta: '1 optional tool', ok: true },
    { title: 'Safety notes', meta: 'Checklist affirmed', ok: true },
    { title: 'Files', meta: 'PDF · none needed to print', ok: true },
  ])
})

it('flags what is missing and counts it in the lead', () => {
  const rows = reviewRows({ ...base, description: null, steps: [{ photo_url: null }], tutorial_pdf_url: null, kind: 'assistive_tech' } as never)
  expect(rows.find((r) => r.title === 'Summary')).toEqual({ title: 'Summary', meta: 'No summary yet', ok: false })
  expect(rows.find((r) => r.title === 'Guide content')).toEqual({ title: 'Guide content', meta: '1 step, 1 without a photo', ok: false })
  expect(rows.find((r) => r.title === 'Files')).toEqual({ title: 'Files', meta: 'no PDF · no STL yet', ok: false })
  expect(reviewLead(rows)).toBe('6 sections, 3 complete.')
})

it('says when every part has a price', () => {
  const priced = { ...base, parts: [{ is_optional: false, price_cents: 600 }, { is_optional: false, price_cents: 0 }] }
  expect(reviewRows(priced as never).find((r) => r.title === 'Parts')).toEqual({ title: 'Parts', meta: '2 parts with prices', ok: true })
})

it('counts the author’s safety notes', () => {
  const noted = { ...base, safety_notes: [{ title: 'a' }, { title: 'b' }] }
  expect(reviewRows(noted as never).find((r) => r.title === 'Safety notes')).toEqual({ title: 'Safety notes', meta: '2 notes · checklist affirmed', ok: true })
})

const row = (t: object, title: string) => reviewRows(t as never).find((r) => r.title === title)!

it('Guide content is ok for steps alone', () => {
  const r = row({ ...base, steps: [{ photo_url: 'p.jpg' }], tutorial_pdf_url: null }, 'Guide content')
  expect(r.ok).toBe(true)
  expect(r.meta).toBe('1 step, all photographed')
})
it('Guide content is ok for a PDF alone', () => {
  const r = row({ ...base, steps: [], tutorial_pdf_url: 'a.pdf' }, 'Guide content')
  expect(r.ok).toBe(true)
  expect(r.meta).toBe('PDF guide')
})
it('Guide content flags neither', () => {
  const r = row({ ...base, steps: [], tutorial_pdf_url: null }, 'Guide content')
  expect(r.ok).toBe(false)
  expect(r.meta).toBe('No steps or PDF yet')
})
it('Files no longer flags a missing PDF', () => {
  const r = row({ ...base, steps: [{ photo_url: 'p.jpg' }], tutorial_pdf_url: null }, 'Files')
  expect(r.ok).toBe(true)
})
