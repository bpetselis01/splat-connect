/**
 * File uploads (PDFs, toy photos, STL models) into Supabase Storage. Web
 * never talks to Storage directly — it posts here and stores the returned
 * public URL in the draft until tutorial submission.
 */
import { Hono } from 'hono'
import { createUserClient } from '../supabase/user-client.js'
import { createAdminClient } from '../supabase/client.js'
import { INVALID_TEXT_REPRESENTATION } from '../supabase/pg-errors.js'
import type { AuthVariables } from '../middleware/auth.js'

const upload = new Hono<{ Variables: AuthVariables }>()

type AccessCheck = { ok: true } | { ok: false; status: 404 | 500; message?: string }

// A contributor may only write into their own tutorial's folder — storage RLS
// (032_scope_upload_buckets_to_owner.sql) enforces the same rule, this is the
// app-layer half of the same defence-in-depth convention as the toy checks below.
async function checkTutorialContributor(
  supabase: ReturnType<typeof createUserClient>,
  tutorialId: string,
  userId: string
): Promise<AccessCheck> {
  const { data: contributor, error } = await supabase
    .from('tutorial_contributors')
    .select('tutorial_id')
    .eq('tutorial_id', tutorialId)
    .eq('profile_id', userId)
    .maybeSingle()
  if (error) {
    if (error.code === INVALID_TEXT_REPRESENTATION) return { ok: false, status: 404 }
    return { ok: false, status: 500, message: error.message }
  }
  if (!contributor) return { ok: false, status: 404 }
  return { ok: true }
}

// Bucket RLS (Task 1) already scopes writes to the owner, but every other
// owner-scoped route in this codebase also checks explicitly (defence in depth).
//
// "Owner" includes a leader of the owning organisation since 033. Without that
// arm an org's stock could never be published at all: publishing requires a
// cover photo, and this is the only way one gets uploaded.
async function checkToyOwner(
  supabase: ReturnType<typeof createUserClient>,
  toyId: string,
  userId: string
): Promise<AccessCheck> {
  const { data: led } = await supabase.from('org_leaders').select('org_id').eq('user_id', userId)
  const orgIds = (led ?? []).map((row: { org_id: string }) => row.org_id)
  const ownership = [`owner_id.eq.${userId}`]
  if (orgIds.length) ownership.push(`owner_org_id.in.(${orgIds.join(',')})`)

  const { data: toy, error } = await supabase
    .from('toys')
    .select('id')
    .eq('id', toyId)
    .or(ownership.join(','))
    .maybeSingle()
  if (error) {
    if (error.code === INVALID_TEXT_REPRESENTATION) return { ok: false, status: 404 }
    return { ok: false, status: 500, message: error.message }
  }
  if (!toy) return { ok: false, status: 404 }
  return { ok: true }
}

upload.post('/pdf', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  const tutorialId = formData.get('tutorialId') as string | null

  if (!file || !tutorialId) {
    return c.json({ error: 'file and tutorialId are required' }, 400)
  }

  const supabase = createUserClient(c.get('token'))

  const access = await checkTutorialContributor(supabase, tutorialId, c.get('userId'))
  if (!access.ok) return c.json({ error: access.message ?? 'Not found' }, access.status)

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

  const userClient = createUserClient(c.get('token'))

  const access = await checkTutorialContributor(userClient, tutorialId, c.get('userId'))
  if (!access.ok) return c.json({ error: access.message ?? 'Not found' }, access.status)

  const ext = file.name.split('.').pop() ?? 'jpg'
  const admin = createAdminClient()

  // WHY: Uploading a new photo in a different format (e.g. switching from .jpg
  //      to .png) left the old file sitting in storage because the filename
  //      changed with the extension, creating two photos for the same tutorial.
  // HOW: All files in the tutorial's photo folder are deleted before uploading
  //      the new one. Admin client used because no DELETE storage policy exists.
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

  const access = await checkTutorialContributor(supabase, tutorialId, c.get('userId'))
  if (!access.ok) return c.json({ error: access.message ?? 'Not found' }, access.status)

  const { data, error } = await supabase.storage
    .from('stl-files')
    .upload(`${tutorialId}/${file.name}`, file, { upsert: true })

  if (error) return c.json({ error: error.message }, 500)

  const { data: urlData } = supabase.storage
    .from('stl-files')
    .getPublicUrl(data.path)

  return c.json({ url: urlData.publicUrl, filename: file.name })
})

upload.post('/toy-cover', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  const toyId = formData.get('toyId') as string | null

  if (!file || !toyId) {
    return c.json({ error: 'file and toyId are required' }, 400)
  }

  const supabase = createUserClient(c.get('token'))

  const access = await checkToyOwner(supabase, toyId, c.get('userId'))
  if (!access.ok) return c.json({ error: access.message ?? 'Not found' }, access.status)

  const ext = file.name.split('.').pop() ?? 'jpg'

  // A toy's folder holds both cover.* and switch-*.* files, so only the
  // existing cover files are removed before uploading the replacement.
  const { data: existing } = await supabase.storage.from('toy-photos-library').list(toyId)
  const existingCovers = existing?.filter((f) => f.name.startsWith('cover.')) ?? []
  if (existingCovers.length) {
    await supabase.storage
      .from('toy-photos-library')
      .remove(existingCovers.map((f) => `${toyId}/${f.name}`))
  }

  const { data, error } = await supabase.storage
    .from('toy-photos-library')
    .upload(`${toyId}/cover.${ext}`, file, { upsert: false })

  if (error) return c.json({ error: error.message }, 500)

  const { data: urlData } = supabase.storage.from('toy-photos-library').getPublicUrl(data.path)

  return c.json({ url: urlData.publicUrl })
})

upload.post('/toy-switch-photo', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  const toyId = formData.get('toyId') as string | null

  if (!file || !toyId) {
    return c.json({ error: 'file and toyId are required' }, 400)
  }

  const supabase = createUserClient(c.get('token'))

  const access = await checkToyOwner(supabase, toyId, c.get('userId'))
  if (!access.ok) return c.json({ error: access.message ?? 'Not found' }, access.status)

  const ext = file.name.split('.').pop() ?? 'jpg'

  // A gallery, not a replace — each switch photo gets its own filename.
  const { data, error } = await supabase.storage
    .from('toy-photos-library')
    .upload(`${toyId}/switch-${crypto.randomUUID()}.${ext}`, file, { upsert: false })

  if (error) return c.json({ error: error.message }, 500)

  const { data: urlData } = supabase.storage.from('toy-photos-library').getPublicUrl(data.path)

  return c.json({ url: urlData.publicUrl })
})

export default upload
