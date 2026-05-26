import { Hono } from 'hono'
import { createAdminClient } from '../supabase/client.js'

const publicRoutes = new Hono()

publicRoutes.get('/tutorials', async (c) => {
  const supabase = createAdminClient()
  const difficulty = c.req.query('difficulty')
  let query = supabase
    .from('tutorials')
    .select('*')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
  if (difficulty) query = query.eq('difficulty', difficulty)
  const { data, error } = await query
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

publicRoutes.get('/tutorials/:id', async (c) => {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('tutorials')
    .select('*, parts(*), tools(*), stl_files(*)')
    .eq('id', c.req.param('id'))
    .eq('status', 'approved')
    .single()
  if (error) return c.json({ error: error.message }, 404)
  return c.json(data)
})

export default publicRoutes
