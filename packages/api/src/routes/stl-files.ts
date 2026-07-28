/**
 * STL files sub-resource: records { filename, file_url } rows for a tutorial
 * the caller owns; the file itself goes through routes/upload.ts first.
 * Optional at submission (upload step 5 always advances). Same pattern as
 * parts.ts and tools.ts.
 */
import { Hono } from 'hono'
import { createUserClient } from '../supabase/user-client.js'
import type { AuthVariables } from '../middleware/auth.js'

const stlFiles = new Hono<{ Variables: AuthVariables }>()

stlFiles.post('/:id/stl-files', async (c) => {
  const body = await c.req.json<{ stl_files: { filename: string; file_url: string }[] }>()
  const supabase = createUserClient(c.get('token'))

  await supabase.from('stl_files').delete().eq('tutorial_id', c.req.param('id'))

  const rows = body.stl_files.map((f) => ({
    tutorial_id: c.req.param('id'),
    filename: f.filename,
    file_url: f.file_url,
  }))

  const { data, error } = await supabase.from('stl_files').insert(rows).select()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})

stlFiles.delete('/:id/stl-files', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { error } = await supabase.from('stl_files').delete().eq('tutorial_id', c.req.param('id'))
  if (error) return c.json({ error: error.message }, 500)
  return c.body(null, 204)
})

export default stlFiles
