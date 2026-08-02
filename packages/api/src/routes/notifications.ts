// packages/api/src/routes/notifications.ts
/**
 * A user's own notifications (Protected), mounted at /api/notifications.
 * Every row is written elsewhere (routes/collaborators.ts,
 * routes/collaborator-invites.ts, routes/admin.ts) using the admin client —
 * this file is read/acknowledge only.
 */
import { Hono } from 'hono'
import { createUserClient } from '../supabase/user-client.js'
import type { AuthVariables } from '../middleware/auth.js'

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
