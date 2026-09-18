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
import { KIND_LABEL } from '@splat-connect/types'

export type SectionId = 'details' | 'safety' | 'parts' | 'tools' | 'files' | 'stl'

export interface Gap {
  section: SectionId
  label: string
}

export const SECTION_LABEL: Record<SectionId, string> = {
  details: 'Details',
  safety: 'Safety',
  parts: 'Parts',
  tools: 'Tools',
  files: 'Files',
  stl: '3D print files',
}

const DIFFICULTIES: string[] = ['easy', 'medium', 'hard']

export function getMissingFields(tutorial: TutorialWithDetails): Gap[] {
  const missing: Gap[] = []
  if (!tutorial.title.trim()) missing.push({ section: 'details', label: 'A title' })
  if (!DIFFICULTIES.includes(tutorial.difficulty))
    missing.push({ section: 'details', label: 'A difficulty' })
  if (!tutorial.tutorial_pdf_url?.trim()) missing.push({ section: 'files', label: 'The guide PDF' })
  if (tutorial.photo_urls.length === 0) missing.push({ section: 'files', label: 'A photo' })
  if (tutorial.parts.length === 0) missing.push({ section: 'parts', label: 'A part' })
  if (tutorial.tools.length === 0) missing.push({ section: 'tools', label: 'A tool' })
  // A printed part is what an assistive-tech tutorial IS, so it cannot be
  // submitted without one. A toy adaptation has no STL section at all, so the
  // gap must never appear for it.
  if (tutorial.kind === 'assistive_tech' && tutorial.stl_files.length === 0)
    missing.push({ section: 'stl', label: 'A 3D-print file' })
  if (!tutorial.safety_declared_at)
    missing.push({ section: 'safety', label: 'The safety declaration' })
  return missing
}

/** The rows this tutorial's kind shows, in hub order. */
export function sectionsFor(kind: TutorialKind): SectionId[] {
  const base: SectionId[] = ['details', 'safety', 'parts', 'tools', 'files']
  return kind === 'assistive_tech' ? [...base, 'stl'] : base
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
    case 'details':
      return `${KIND_LABEL[t.kind]} - ${DIFFICULTY_LABEL[t.difficulty] ?? 'No difficulty'}`
    case 'safety':
      return t.safety_declared_at ? 'Declared' : 'Not declared yet'
    case 'parts':
      return t.parts.length ? count(t.parts.length, 'part') : 'None yet - at least one'
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
