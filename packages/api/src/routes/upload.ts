/**
 * File Upload Route (Protected)
 * 
 * Handles file uploads (PDFs, photos, STL models) to Supabase Storage.
 * All file operations go through this endpoint (not directly to Supabase from web).
 * 
 * Endpoint:
 * - POST /api/upload
 *   - Body: FormData with 'file' field
 *   - Auth: Requires JWT with approved=true
 *   - Returns: { url: string } (public URL of uploaded file)
 * 
 * Supported files:
 * - PDFs: Tutorial instruction files
 * - Images: JPG, PNG (toy photos)
 * - 3D Models: STL files for 3D printing
 * 
 * Storage buckets (in Supabase):
 * - tutorials_pdfs: Tutorial PDF files
 * - toy_photos: Photos of toys
 * - stl_files: 3D model files
 * 
 * Security:
 * - Validates JWT + user approval before accepting file
 * - Supabase Storage enforces RLS: users can only upload to their own folders
 * - File size limits enforced by Supabase
 * 
 * Process:
 * 1. Web calls /api/upload with JWT
 * 2. This middleware validates JWT + approved status
 * 3. Route handler uploads file to appropriate Supabase Storage bucket
 * 4. Returns public URL for file
 * 5. Web stores URL in UploadDraft (tutorial_pdf_url, toy_photo_url, etc.)
 * 6. When user submits tutorial, URLs are saved to database
 * 
 * Related files:
 * - middleware/auth.ts: JWT validation
 * - routes/tutorials.ts: Tutorial creation (which includes file URLs)
 * - web components: Call this endpoint when uploading files
 */
import { Hono } from 'hono'
import { createUserClient } from '../supabase/user-client.js'
import type { AuthVariables } from '../middleware/auth.js'

const upload = new Hono<{ Variables: AuthVariables }>()

upload.post('/pdf', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  const tutorialId = formData.get('tutorialId') as string | null

  if (!file || !tutorialId) {
    return c.json({ error: 'file and tutorialId are required' }, 400)
  }

  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase.storage
    .from('tutorial-pdfs')
    .upload(`${tutorialId}/tutorial.pdf`, file, { upsert: true })

  if (error) return c.json({ error: error.message }, 500)

  const { data: urlData } = supabase.storage
    .from('tutorial-pdfs')
    .getPublicUrl(data.path)

  return c.json({ url: urlData.publicUrl })
})

upload.post('/photo', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  const tutorialId = formData.get('tutorialId') as string | null

  if (!file || !tutorialId) {
    return c.json({ error: 'file and tutorialId are required' }, 400)
  }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase.storage
    .from('toy-photos')
    .upload(`${tutorialId}/photo.${ext}`, file, { upsert: true })

  if (error) return c.json({ error: error.message }, 500)

  const { data: urlData } = supabase.storage
    .from('toy-photos')
    .getPublicUrl(data.path)

  return c.json({ url: urlData.publicUrl })
})

upload.post('/stl', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  const tutorialId = formData.get('tutorialId') as string | null

  if (!file || !tutorialId) {
    return c.json({ error: 'file and tutorialId are required' }, 400)
  }

  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase.storage
    .from('stl-files')
    .upload(`${tutorialId}/${file.name}`, file, { upsert: true })

  if (error) return c.json({ error: error.message }, 500)

  const { data: urlData } = supabase.storage
    .from('stl-files')
    .getPublicUrl(data.path)

  return c.json({ url: urlData.publicUrl, filename: file.name })
})

export default upload
