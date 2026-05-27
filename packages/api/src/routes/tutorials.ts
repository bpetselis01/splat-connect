import { Hono } from 'hono'
import { createUserClient } from '../supabase/user-client.js'
import { createAdminClient } from '../supabase/client.js'
import type { AuthVariables } from '../middleware/auth.js'

const tutorials = new Hono<{ Variables: AuthVariables }>()

tutorials.get('/', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('tutorials')
    .select('*, tutorial_contributors!inner(profile_id)')
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

tutorials.get('/mine', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('tutorials')
    .select('*, tutorial_contributors!inner(profile_id)')
    .eq('tutorial_contributors.profile_id', c.get('userId'))
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

tutorials.get('/:id', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('tutorials')
    .select('*, parts(*), tools(*), stl_files(*), tutorial_contributors(*, profiles(*))')
    .eq('id', c.req.param('id'))
    .single()
  if (error) return c.json({ error: error.message }, 404)
  return c.json(data)
})

tutorials.post('/', async (c) => {
  if (!c.get('approved')) {
    return c.json({ error: 'Your account is not yet approved to create tutorials' }, 403)
  }
  const body = await c.req.json()
  // Auth/approval already verified above -- use admin client to bypass RLS JWT context issues
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('tutorials')
    .insert({
      id: body.id,
      title: body.title,
      difficulty: body.difficulty,
      description: body.description ?? null,
      status: 'draft',
      tutorial_pdf_url: body.tutorial_pdf_url ?? null,
      toy_photo_url: body.toy_photo_url ?? null,
    })
    .select()
    .single()
  if (error) {
    // 23505 = unique_violation: tutorial already exists (retry-safe)
    if (error.code === '23505') return c.json({ id: body.id }, 200)
    console.error('[POST /api/tutorials] Supabase error:', error.code, error.message)
    return c.json({ error: error.message }, 500)
  }
  return c.json(data, 201)
})

tutorials.patch('/:id', async (c) => {
  const body = await c.req.json()
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('tutorials')
    .update(body)
    .eq('id', c.req.param('id'))
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

tutorials.delete('/:id', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { error } = await supabase
    .from('tutorials')
    .delete()
    .eq('id', c.req.param('id'))
  if (error) return c.json({ error: error.message }, 500)
  return c.body(null, 204)
})

export default tutorials