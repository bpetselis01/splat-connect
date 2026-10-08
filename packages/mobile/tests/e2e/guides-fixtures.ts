import { adminClient } from './helpers'

/**
 * Steps for a guide the spec already created. createTutorial() seeds parts and
 * tools only; tutorial_steps is position 1-60, body required (080).
 */
export async function addSteps(tutorialId: string, steps: { title?: string | null; body: string }[]) {
  const { error } = await adminClient()
    .from('tutorial_steps')
    .insert(steps.map((s, i) => ({ tutorial_id: tutorialId, position: i + 1, title: s.title ?? null, body: s.body })))
  if (error) throw new Error(`Failed to add steps: ${error.message}`)
}

/** A returned guide with the reviewer's reason, as the contributor sees it in My tutorials. */
export async function rejectWithNote(tutorialId: string, note: string) {
  const { error } = await adminClient().from('tutorials').update({ status: 'rejected', rejection_note: note }).eq('id', tutorialId)
  if (error) throw new Error(`Failed to reject tutorial: ${error.message}`)
}

/** A community note by someone else (093); `pinnedBy` makes it a pinned revision. */
export async function addNote(tutorialId: string, authorId: string, fields: { step_position: number | null; body: string; pinnedBy?: string }): Promise<string> {
  const { data, error } = await adminClient()
    .from('tutorial_notes')
    .insert({
      tutorial_id: tutorialId,
      author_id: authorId,
      step_position: fields.step_position,
      body: fields.body,
      ...(fields.pinnedBy ? { pinned_at: new Date().toISOString(), pinned_by: fields.pinnedBy } : {}),
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`addNote failed: ${error?.message}`)
  return data.id
}
