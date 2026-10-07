import { adminClient } from './auth.js'

/** Give a test user a name, so a notification's actor_name can be asserted exactly. */
export async function nameUser(id: string, name: string): Promise<void> {
  const { error } = await adminClient().from('profiles').update({ name }).eq('id', id)
  if (error) throw new Error(`nameUser failed: ${error.message}`)
}

export interface NoteRow {
  recipient_id: string
  type: string
  toy_transaction_id: string | null
  toy_name: string | null
  actor_name: string
  body: string | null
}

/**
 * The notifications one person holds about one transaction, oldest first. The
 * transaction id IS the link target: mobile's linkFor opens a thread (or a
 * build, or a print job) from toy_transaction_id and the type alone.
 */
export async function notesAbout(recipientId: string, txId: string): Promise<NoteRow[]> {
  const { data, error } = await adminClient()
    .from('notifications')
    .select('recipient_id, type, toy_transaction_id, toy_name, actor_name, body')
    .eq('recipient_id', recipientId)
    .eq('toy_transaction_id', txId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(`notesAbout failed: ${error.message}`)
  return (data ?? []) as NoteRow[]
}
