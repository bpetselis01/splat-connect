/**
 * The one writer of notification rows for routes. By the time a route calls it
 * the write the notification is about has committed, so a failed insert (the
 * CHECK refusing a type whose migration is not on the database yet, a network
 * error) is logged and swallowed: it must never fail the request.
 *
 * The log line is stable and greppable after a deploy:
 *   [notify] insert failed type=<type> code=<pg code> label=<label>
 *   [notify] chunked rows=<n> label=<label>   (a send above 500 rows)
 */
import { createAdminClient } from './supabase/client.js'
import { chunk } from './chunk.js'

export async function notify(rows: Array<Record<string, unknown>>, label: string) {
  if (rows.length > 500) console.error(`[notify] chunked rows=${rows.length} label=${label}`)
  for (const part of chunk(rows, 500)) {
    let code = 'none'
    try {
      const { error } = await createAdminClient().from('notifications').insert(part)
      if (!error) continue
      code = error.code || code
    } catch {
      code = 'thrown'
    }
    console.error(`[notify] insert failed type=${part[0]?.type} code=${code} label=${label}`)
  }
}
