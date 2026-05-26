import { Hono } from 'hono'
import { createAdminClient } from '../supabase/client.js'
import type { AuthVariables } from '../middleware/auth.js'
import type { TutorialStatus } from '@splat-connect/types'

const admin = new Hono<{ Variables: AuthVariables }>()

admin.use('*', async (c, next) => {
  if (c.get('role') !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403)
  }
  await next()
})

admin.get('/tutorials', async (c) => {
  const supabase = createAdminClient()
  const status = (c.req.query('status') ?? 'pending') as TutorialStatus
  const { data, error } = await supabase
    .from('tutorials')
    .select('*, tutorial_contributors(profile_id)')
    .eq('status', status)
    .order('created_at', { ascending: true })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

admin.patch('/tutorials/:id/status', async (c) => {
  const body = await c.req.json<{ status: TutorialStatus; rejection_note?: string }>()
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('tutorials')
    .update({
      status: body.status,
      reviewed_at: new Date().toISOString(),
      ...(body.rejection_note !== undefined ? { rejection_note: body.rejection_note || null } : {}),
    })
    .eq('id', c.req.param('id'))
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

admin.get('/contributors', async (c) => {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'contributor')
    .order('created_at', { ascending: true })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

admin.patch('/contributors/:id/approve', async (c) => {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('profiles')
    .update({ approved: true })
    .eq('id', c.req.param('id'))
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

admin.delete('/contributors/:id', async (c) => {
  const supabase = createAdminClient()
  const { error } = await supabase.auth.admin.deleteUser(c.req.param('id'))
  if (error) return c.json({ error: error.message }, 500)
  return c.body(null, 204)
})

export default admin
