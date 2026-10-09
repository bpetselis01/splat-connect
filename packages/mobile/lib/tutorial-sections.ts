// packages/mobile/lib/tutorial-sections.ts
//
// What a draft still needs, and which screen closes each gap.
//
// Ported from web's lib/validation.ts getMissingFields, with one deliberate
// divergence: the safety gap reports `section: 'safety'` rather than riding
// along with details, because the hub gives safety a row of its own. Every
// other rule is the same eight lines in the same order — a change there is the
// reminder to bring this copy along.
import type { Difficulty, TutorialKind, TutorialWithDetails } from '@splat-connect/types'
import { KIND_LABEL, formatCents, partsTotalCents } from '@splat-connect/types'

// 'steps' (080) is optional: no gap ever names it, so it never blocks submit
// and Next never lands on it — a contributor opens it from the hub.
export type SectionId = 'details' | 'steps' | 'safety' | 'suits' | 'picks' | 'parts' | 'tools' | 'files' | 'stl'

export interface Gap {
  section: SectionId
  label: string
}

export const SECTION_LABEL: Record<SectionId, string> = {
  details: 'Details',
  steps: 'Steps',
  safety: 'Safety',
  suits: "Who it's for",
  picks: 'Worth a look',
  parts: 'Parts',
  tools: 'Tools',
  files: 'Files',
  stl: '3D print files',
}

const DIFFICULTIES: string[] = ['easy', 'medium', 'hard']

export interface Check {
  section: SectionId
  label: string
  done: boolean
}

/** Every requirement, met or not. getMissingFields and the per-page strip both read this. */
export function sectionChecks(tutorial: TutorialWithDetails): Check[] {
  return [
    { section: 'details', label: 'A title', done: Boolean(tutorial.title.trim()) },
    { section: 'details', label: 'A difficulty', done: DIFFICULTIES.includes(tutorial.difficulty) },
    { section: 'details', label: 'A build time', done: tutorial.build_minutes != null },
    { section: 'files', label: 'The guide PDF', done: Boolean(tutorial.tutorial_pdf_url?.trim()) },
    { section: 'files', label: 'A photo', done: tutorial.photo_urls.length > 0 },
    { section: 'parts', label: 'A part', done: tutorial.parts.length > 0 },
    { section: 'tools', label: 'A tool', done: tutorial.tools.length > 0 },
    // A printed part is what an assistive-tech tutorial IS; a toy adaptation has no STL section.
    ...(tutorial.kind === 'assistive_tech'
      ? [{ section: 'stl' as const, label: 'A 3D-print file', done: tutorial.stl_files.length > 0 }]
      : []),
    { section: 'safety', label: 'The safety declaration', done: Boolean(tutorial.safety_declared_at) },
  ]
}

export function getMissingFields(tutorial: TutorialWithDetails): Gap[] {
  return sectionChecks(tutorial)
    .filter((c) => !c.done)
    .map(({ section, label }) => ({ section, label }))
}

/** The rows this tutorial's kind shows, in hub order. */
export function sectionsFor(kind: TutorialKind): SectionId[] {
  // The board's order: what it is, how to build it, what to buy, what to use,
  // what could hurt, then the files.
  const base: SectionId[] = ['details', 'steps', 'parts', 'tools', 'safety', 'suits', 'picks', 'files']
  return kind === 'assistive_tech' ? [...base, 'stl'] : base
}

/** The hub's "{ready} of {total} sections complete", shared with My tutorials. */
export function sectionProgress(t: TutorialWithDetails): { ready: number; total: number } {
  // 'suits' and 'picks' are all optional: counting them would show a finished bar for a section nobody has opened.
  const sections = sectionsFor(t.kind).filter((s) => s !== 'suits' && s !== 'picks')
  const incomplete = new Set(getMissingFields(t).map((g) => g.section))
  return { ready: sections.filter((s) => !incomplete.has(s)).length, total: sections.length }
}

/**
 * Where a section's "Next" goes: the next section still missing something,
 * wrapping past the end, skipping the one you are on.
 *
 * Deliberately not "the next screen in the list" — that would make the sections
 * a wizard, which the hub exists to not be. A fresh draft walks straight
 * through because everything is incomplete; a contributor who came back to fix
 * one gap is offered the gap, not a tour. Returns null when nothing is left,
 * and the footer offers Submit instead.
 */
export function nextIncompleteSection(
  current: SectionId,
  tutorial: TutorialWithDetails
): SectionId | null {
  const sections = sectionsFor(tutorial.kind)
  const incomplete = new Set(getMissingFields(tutorial).map((g) => g.section))
  const from = sections.indexOf(current)
  // Start one past `current` and wrap, so the last section points back at
  // whatever is still open near the top rather than dead-ending.
  for (let i = 1; i <= sections.length; i++) {
    const section = sections[(from + i) % sections.length]
    if (section !== current && incomplete.has(section)) return section
  }
  return null
}

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`

/**
 * The line under a row's name. An incomplete section says what it is waiting
 * for; a complete one says what it holds. Prose rather than a status dot,
 * because "None yet" is the instruction and a dot is only a colour.
 */
export function sectionSummary(section: SectionId, t: TutorialWithDetails): string {
  switch (section) {
    case 'details': {
      const base = `${KIND_LABEL[t.kind]} - ${DIFFICULTY_LABEL[t.difficulty] ?? 'No difficulty'}`
      // The one details gap the row's other words cannot show (066): without
      // it the hub says "1 thing still needed" and every row reads finished.
      return t.build_minutes == null ? `${base} - no build time yet` : base
    }
    case 'steps': {
      const n = t.steps?.length ?? 0
      return n ? count(n, 'step') : '0 steps - nothing yet'
    }
    case 'safety':
      return t.safety_declared_at ? 'Declared' : 'Not declared yet'
    case 'suits': {
      const n = (t.device_types?.length ?? 0) + (t.helps_with?.length ?? 0) + (t.access?.length ?? 0) + (t.one_hand ? 1 : 0) + (t.press_force?.length ?? 0) + (t.play?.length ?? 0)
      return n ? count(n, 'answer') : 'Optional - helps families find it'
    }
    case 'picks': {
      const n = t.tutorial_recommendations?.length ?? 0
      return n ? count(n, 'guide') : 'Optional - up to three guides to read next'
    }
    case 'parts': {
      const total = partsTotalCents(t.parts)
      return t.parts.length ? `${count(t.parts.length, 'part')}${total != null ? `, ${formatCents(total)} total` : ''}` : 'None yet - at least one'
    }
    case 'tools':
      return t.tools.length ? count(t.tools.length, 'tool') : 'None yet - at least one'
    case 'files': {
      const pdf = Boolean(t.tutorial_pdf_url?.trim())
      const photo = t.photo_urls.length > 0
      if (pdf && photo) return 'PDF and photo added'
      if (!pdf && !photo) return 'Guide PDF and a photo'
      return pdf ? 'A photo' : 'The guide PDF'
    }
    case 'stl':
      return t.stl_files.length ? count(t.stl_files.length, 'file') : 'No STL yet'
  }
}

/** Whole years from an age field; pasted text that is not a number is no age. */
export function parseYears(text: string): number | null {
  const n = parseInt(text, 10)
  return Number.isNaN(n) ? null : n
}
