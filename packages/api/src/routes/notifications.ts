// packages/api/src/routes/notifications.ts
/**
 * A user's own notifications (Protected), mounted at /api/notifications.
 * Every row is written elsewhere (routes/collaborators.ts,
 * routes/collaborator-invites.ts, routes/admin.ts) using the admin client —
 * this file is read/acknowledge only.
 */
import { Hono } from 'hono'
import { createUserClient } from '../supabase/client.js'
import type { AuthVariables } from '../middleware/auth.js'
import {
  notificationBucket,
  typesInBucket,
  type NotificationType,
  type NotificationBucket,
  type UnreadCounts,
} from '@splat-connect/types'

const notifications = new Hono<{ Variables: AuthVariables }>()

notifications.get('/me', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', c.get('userId'))
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

notifications.get('/me/unread-count', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', c.get('userId'))
    .is('read_at', null)
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ count: count ?? 0 })
})

/**
 * Unread, split by which My SPLAT card owns it. The singular /me/unread-count
 * above has no caller left in web or mobile; it stays for the integration
 * test that still exercises it and for any external consumer.
 *
 * Counted in JS over the unread rows rather than as three grouped queries:
 * one round trip, and the set is a single user's *unread* notifications.
 * ponytail: linear scan, push the grouping into SQL if someone ever carries
 * thousands unread.
 */
notifications.get('/me/unread-counts', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('notifications')
    .select('type')
    .eq('recipient_id', c.get('userId'))
    .is('read_at', null)
  if (error) return c.json({ error: error.message }, 500)

  const counts: UnreadCounts = { tutorials: 0, exchanges: 0, challenges: 0, total: 0 }
  for (const row of (data ?? []) as { type: NotificationType }[]) {
    // The DB constraint (043_idea_graduated_notification.sql) and the
    // NotificationType union are pinned to the same 18 values today, so this
    // never falls through in practice. If they ever drift, a SQL-only type
    // would return undefined here rather than corrupt a bucket count.
    const bucket = notificationBucket(row.type)
    if (bucket) counts[bucket] += 1
    counts.total += 1
  }
  return c.json(counts)
})

/**
 * Clear one card's badge. Called when its destination page opens, which is why
 * this is a bucket rather than a list of ids — the page does not know them.
 *
 * The bucket is allowlisted, not cast: an unrecognised value must 400 rather
 * than fall through to an update with an empty `in`, which is silent and wrong.
 */
notifications.post('/me/read', async (c) => {
  const body = await c.req.json<{ bucket?: string }>().catch(() => ({ bucket: undefined }))
  const allowed: NotificationBucket[] = ['tutorials', 'exchanges', 'challenges']
  const bucket = allowed.find((b) => b === body.bucket)
  if (!bucket) {
    return c.json({ error: 'bucket must be tutorials, exchanges or challenges' }, 400)
  }

  const supabase = createUserClient(c.get('token'))
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', c.get('userId'))
    .is('read_at', null)
    .in('type', typesInBucket(bucket))
  if (error) return c.json({ error: error.message }, 500)
  return c.body(null, 204)
})

notifications.patch('/:id', async (c) => {
  const body = await c.req.json<{ read?: boolean }>()
  if (body.read !== true) return c.json({ error: 'only { read: true } is supported' }, 400)

  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', c.req.param('id'))
    .select('id')
  if (error) return c.json({ error: error.message }, 500)
  if (!data.length) return c.json({ error: 'not your notification' }, 403)
  return c.body(null, 204)
})

export default notifications
