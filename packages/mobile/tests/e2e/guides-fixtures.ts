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
