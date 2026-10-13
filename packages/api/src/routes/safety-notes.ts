import { subResourceRoutes } from './sub-resource.js'

type SafetyNoteInput = { title: string; detail?: string | null }

const MAX_NOTES = 20

function safetyNotesError(notes: SafetyNoteInput[]): string | null {
  if (notes.length > MAX_NOTES) return `A guide can have up to ${MAX_NOTES} safety notes`
  for (const [i, n] of notes.entries()) {
    const k = i + 1
    if (typeof n?.title !== 'string' || !n.title.trim()) return `Safety note ${k} needs a title`
    if (n.title.trim().length > 80) return `Safety note ${k}'s title is over 80 characters`
    if (n.detail != null && (typeof n.detail !== 'string' || n.detail.trim().length > 500)) return `Safety note ${k}'s detail is over 500 characters`
  }
  return null
}

export default subResourceRoutes<SafetyNoteInput>({
  path: 'safety-notes',
  table: 'tutorial_safety_notes',
  bodyKey: 'safety_notes',
  validate: safetyNotesError,
  mapRow: (n, tutorialId, i) => ({
    tutorial_id: tutorialId,
    position: i + 1,
    title: n.title.trim(),
    detail: n.detail?.trim() || null,
  }),
})
