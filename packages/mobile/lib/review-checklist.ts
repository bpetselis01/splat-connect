// packages/mobile/lib/review-checklist.ts
//
// The board's org_review rows: one per section of the guide, what it holds,
// OK or Flag. A suggestion for the reviewer's eye, not a gate — the API's
// submit rules are the gate.
import type { TutorialWithDetails } from '@splat-connect/types'

export type ReviewRow = { title: string; meta: string; ok: boolean }

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`

export function reviewRows(t: TutorialWithDetails): ReviewRow[] {
  const steps = t.steps ?? []
  const bare = steps.filter((s) => !s.photo_url).length
  const optionalTools = t.tools.filter((x) => x.is_optional).length
  const pdf = Boolean(t.tutorial_pdf_url)
  const needsStl = t.kind === 'assistive_tech'
  const stl = t.stl_files.length
  return [
    { title: 'Summary', meta: t.description?.trim() ? 'Complete' : 'No summary yet', ok: Boolean(t.description?.trim()) },
    {
      title: 'Guide content',
      meta: steps.length
        ? bare
          ? `${count(steps.length, 'step')}, ${bare} without a photo`
          : `${count(steps.length, 'step')}, all photographed`
        : pdf
          ? 'PDF guide'
          : 'No steps or PDF yet',
      ok: pdf || (steps.length > 0 && bare === 0),
    },
    {
      title: 'Parts',
      meta: !t.parts.length
        ? 'No parts listed'
        : t.parts.every((p) => p.price_cents != null)
          ? `${count(t.parts.length, 'part')} with prices`
          : `${count(t.parts.length, 'part')}, ${t.parts.filter((p) => p.price_cents == null).length} without a price`,
      ok: t.parts.length > 0,
    },
    {
      title: 'Tools',
      meta: !t.tools.length ? 'No tools listed' : optionalTools === t.tools.length ? count(t.tools.length, 'optional tool') : count(t.tools.length, 'tool'),
      ok: t.tools.length > 0,
    },
    {
      title: 'Safety notes',
      meta: [t.safety_notes?.length ? count(t.safety_notes.length, 'note') : null, t.safety_declared_at ? 'checklist affirmed' : 'checklist not affirmed']
        .filter(Boolean)
        .join(' · ')
        .replace(/^c/, 'C'),
      ok: Boolean(t.safety_declared_at),
    },
    {
      title: 'Files',
      meta: [pdf ? 'PDF' : 'no PDF', stl ? count(stl, 'STL file') : needsStl ? 'no STL yet' : 'none needed to print'].join(' · '),
      ok: !needsStl || stl > 0,
    },
  ]
}

export const reviewLead = (rows: ReviewRow[]) => `${rows.length} sections, ${rows.filter((r) => r.ok).length} complete.`
