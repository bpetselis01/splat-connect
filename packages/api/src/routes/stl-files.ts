/**
 * STL Files Routes (Protected)
 * 
 * Handles adding and removing 3D model files (STL format) for tutorials.
 * STL files allow users to 3D print custom adaptation pieces.
 * 
 * Endpoints:
 * - POST /api/tutorials/:id/stl-files
 *   - Add a new 3D model file to a tutorial
 *   - Body: { filename, file_url }
 *   - Auth: Requires JWT + user must own tutorial
 *   - Returns: StlFile object
 * 
 * - DELETE /api/tutorials/:id/stl-files/:fileId
 *   - Remove a 3D file from a tutorial
 *   - Auth: Requires JWT + user must own tutorial
 *   - Returns: 204 No Content
 * 
 * StlFile structure:
 * - filename: Name of the 3D model file
 * - file_url: URL to download the STL file from Supabase Storage
 * 
 * Workflow:
 * 1. User uploads STL file in upload form step 5 using file-drop-zone
 * 2. Web calls POST /api/upload with file (multipart/form-data)
 * 3. API uploads file to Supabase Storage and returns file_url
 * 4. Web displays uploaded file in list
 * 5. When user submits tutorial:
 *    - Web calls POST /api/tutorials/:id/stl-files with { filename, file_url }
 *    - API creates StlFile record in database
 * 6. When viewing tutorial, file appears as downloadable link
 * 
 * Note: STL files are OPTIONAL (step 5 always allows advancing).
 * 
 * Related files:
 * - routes/tutorials.ts: Tutorial CRUD (stl-files are sub-resources)
 * - routes/upload.ts: File upload endpoint (creates file_url)
 * - routes/parts.ts: Similar pattern for materials
 * - routes/tools.ts: Similar pattern for tools
 * - components/file-drop-zone.tsx: Client-side file upload UI
 * - types/index.ts: StlFile type definition
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
