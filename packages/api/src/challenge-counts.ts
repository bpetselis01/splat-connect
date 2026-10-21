import type { ChallengeCounts } from '@splat-connect/types'
import { selectIn } from './chunk.js'
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
  const [joins, replies] = await Promise.all([
    selectIn(ids, (c) => admin.from('toy_idea_participants').select('idea_id').in('idea_id', c).is('removed_at', null)),
    selectIn(ids, (c) => admin.from('toy_idea_messages').select('idea_id, sender_id').in('idea_id', c).eq('kind', 'user')),
  ])
  const error = joins.error ?? replies.error
  if (error) throw new Error(`Challenge counts failed: ${error.message}`)
  for (const j of joins.data) out.get(j.idea_id as string)!.maker_count++
  for (const r of replies.data) {
    if (r.sender_id !== author.get(r.idea_id as string)) out.get(r.idea_id as string)!.answer_count++
  }
  return out
}
