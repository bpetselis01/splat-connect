import type { ChallengeCounts } from '@splat-connect/types'
import { createAdminClient } from './supabase/client.js'

/**
 * The two numbers a challenge card carries: makers who joined (current
 * participants), and answers — replies from anyone but the asker. Counts, not
 * rows: the thread itself stays private (the brief recruits; the conversation
 * does not), and a number discloses nothing a reader could not see by joining.
 * Shared by the public list and detail and by an account's own lists.
 */
export async function challengeCounts(ideas: { id: string; author_id: string }[]): Promise<Map<string, ChallengeCounts>> {
  const out = new Map(ideas.map((i) => [i.id, { maker_count: 0, answer_count: 0 }]))
  const ids = ideas.map((i) => i.id)
  if (ids.length === 0) return out
  const author = new Map(ideas.map((i) => [i.id, i.author_id]))
  const admin = createAdminClient()
  const [{ data: joins }, { data: replies }] = await Promise.all([
    admin.from('toy_idea_participants').select('idea_id').in('idea_id', ids).is('removed_at', null),
    admin.from('toy_idea_messages').select('idea_id, sender_id').in('idea_id', ids).eq('kind', 'user'),
  ])
  for (const j of joins ?? []) out.get(j.idea_id as string)!.maker_count++
  for (const r of replies ?? []) {
    if (r.sender_id !== author.get(r.idea_id as string)) out.get(r.idea_id as string)!.answer_count++
  }
  return out
}
