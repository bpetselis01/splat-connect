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
