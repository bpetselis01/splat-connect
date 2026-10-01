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
    { title: 'Steps', meta: '2 steps, all photographed', ok: true },
    { title: 'Parts', meta: '3 parts', ok: true },
    { title: 'Tools', meta: '1 optional tool', ok: true },
    { title: 'Safety notes', meta: 'Checklist affirmed', ok: true },
    { title: 'Files', meta: 'PDF · none needed to print', ok: true },
  ])
})

it('flags what is missing and counts it in the lead', () => {
  const rows = reviewRows({ ...base, description: null, steps: [{ photo_url: null }], kind: 'assistive_tech' } as never)
  expect(rows.find((r) => r.title === 'Summary')).toEqual({ title: 'Summary', meta: 'No summary yet', ok: false })
  expect(rows.find((r) => r.title === 'Steps')).toEqual({ title: 'Steps', meta: '1 step, 1 without a photo', ok: false })
  expect(rows.find((r) => r.title === 'Files')).toEqual({ title: 'Files', meta: 'PDF · no STL yet', ok: false })
  expect(reviewLead(rows)).toBe('6 sections, 3 complete.')
})
