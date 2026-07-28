/**
 * File uploads (PDFs, toy photos, STL models) into Supabase Storage. Web
 * never talks to Storage directly — it posts here and stores the returned
 * public URL in the draft until tutorial submission.
 */
import { Hono } from 'hono'
import { createUserClient } from '../supabase/user-client.js'
import { createAdminClient } from '../supabase/client.js'
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
  const admin = createAdminClient()
  const userClient = createUserClient(c.get('token'))

  // WHY: Uploading a new photo in a different format (e.g. switching from .jpg
  //      to .png) left the old file sitting in storage because the filename
  //      changed with the extension, creating two photos for the same tutorial.
  // HOW: All files in the tutorial's photo folder are deleted before uploading
  //      the new one, so there is always exactly one photo per tutorial.
  // Delete every existing file under this tutorial's photo folder before
  // uploading so that extension changes (jpg → png etc.) don't accumulate
  // multiple files. Admin client used because no DELETE storage policy exists.
  const { data: existing } = await admin.storage.from('toy-photos').list(tutorialId)
  if (existing?.length) {
    await admin.storage
      .from('toy-photos')
      .remove(existing.map((f) => `${tutorialId}/${f.name}`))
  }

  const { data, error } = await userClient.storage
    .from('toy-photos')
    .upload(`${tutorialId}/photo.${ext}`, file, { upsert: false })

  if (error) return c.json({ error: error.message }, 500)

  const { data: urlData } = userClient.storage
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
