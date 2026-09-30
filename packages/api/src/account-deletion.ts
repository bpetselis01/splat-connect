/**
 * Everything around 083's delete_account() that the database cannot do:
 * Storage objects under each deleted toy or guide, and a notification to the
 * other person on every exchange it cancelled. Shared by the self-serve route
 * (routes/me.ts) and the admin's delete.
 *
 * Both run after the data is gone and are best effort: a lingering file or a
 * missed notification must not report a completed deletion as failed.
 */
import { createAdminClient } from './supabase/client.js'
import { subjectName } from './routes/toy-transactions.js'

type Admin = ReturnType<typeof createAdminClient>
export type DeletionResult = {
  cancelled: { id: string; status: 'withdrawn' | 'rejected'; other: string | null }[]
  toyIds: string[]
  tutorialIds: string[]
}

// Every bucket whose object paths start with a toy or tutorial id.
const BUCKETS = ['toy-photos', 'toy-photos-library', 'tutorial-pdfs', 'stl-files']

export async function deleteAccount(admin: Admin, userId: string, keepCredit: boolean) {
  const { data, error } = await admin.rpc('delete_account', { uid: userId, keep_credit: keepCredit })
  if (error) return { error: error.message.includes('sole_leader') ? ('sole_leader' as const) : error.message }
  const result = data as DeletionResult
  await Promise.allSettled([removeFiles(admin, [...result.toyIds, ...result.tutorialIds]), notifyCancelled(admin, result)])
  return { result }
}

async function removeFiles(admin: Admin, ids: string[]) {
  for (const bucket of BUCKETS) {
    for (const id of ids) {
      const { data } = await admin.storage.from(bucket).list(id, { limit: 1000 })
      const paths = (data ?? []).map((f) => `${id}/${f.name}`)
      if (paths.length) {
        const { error } = await admin.storage.from(bucket).remove(paths)
        if (error) console.error(`account deletion: ${bucket}/${id} left behind`, error.message)
      }
    }
  }
}

async function notifyCancelled(admin: Admin, { cancelled }: DeletionResult) {
  for (const c of cancelled) {
    if (!c.other) continue // an organisation's side, or an open build nobody took
    const { data: tx } = await admin.from('toy_transactions').select('type, toy_id, tutorial_id').eq('id', c.id).single()
    await admin.from('notifications').insert({
      recipient_id: c.other,
      type: c.status === 'withdrawn' ? 'toy_withdrawn' : 'toy_rejected',
      toy_transaction_id: c.id,
      toy_name: tx ? await subjectName(admin, tx) : null,
      actor_name: 'A member who left SPLAT',
    })
  }
}
