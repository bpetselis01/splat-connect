import { createUserClient } from './supabase/client.js'
import { notifyTutorialSubmitted } from './review-notifications.js'
import type { AuthVariables } from './middleware/auth.js'

/**
 * A content edit (steps, safety notes, parts, tools, STL files) takes an
 * approved guide back to pending. The status filter makes it one event: a
 * second edit finds the guide already pending and notifies nobody. An admin's
 * own edit is a fix, not a submission, so it leaves the guide live.
 * Returns the database's message when the move failed.
 */
export async function sendApprovedGuideBackToReview(
  who: Pick<AuthVariables, 'token' | 'userId' | 'role'>,
  tutorialId: string
): Promise<string | null> {
  if (who.role === 'admin') return null
  const { data, error } = await createUserClient(who.token)
    .from('tutorials')
    .update({ status: 'pending' })
    .eq('id', tutorialId)
    .eq('status', 'approved')
    .select('title')
  if (error) return error.message
  if (data.length) {
    await notifyTutorialSubmitted({ tutorialId, tutorialTitle: data[0].title, actorId: who.userId })
  }
  return null
}
