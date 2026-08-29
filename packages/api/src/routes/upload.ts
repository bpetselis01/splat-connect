/**
 * File uploads (PDFs, toy photos, STL models) into Supabase Storage. Web
 * never talks to Storage directly — it posts here and stores the returned
 * public URL in the draft until tutorial submission.
 */
import { Hono, type Context } from 'hono'
import { createUserClient, createAdminClient } from '../supabase/client.js'
import { INVALID_TEXT_REPRESENTATION } from '../supabase/pg-errors.js'
import { ledOrgIds, ownedByCaller } from '../toy-access.js'
import type { AuthVariables } from '../middleware/auth.js'

const upload = new Hono<{ Variables: AuthVariables }>()

type Ctx = Context<{ Variables: AuthVariables }>
type UserClient = ReturnType<typeof createUserClient>

/** Reads the one shape every upload posts. Returns the 400 instead on a bad body. */
async function readUpload(c: Ctx, idField: 'tutorialId' | 'toyId') {
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  const id = formData.get(idField) as string | null
  if (!file || !id) return c.json({ error: `file and ${idField} are required` }, 400)
  return [file, id] as const
}

/** null when the caller may write, otherwise the response to return. */
function denied(c: Ctx, row: unknown, error: { code?: string; message: string } | null) {
  if (error && error.code !== INVALID_TEXT_REPRESENTATION) return c.json({ error: error.message }, 500)
  if (error || !row) return c.json({ error: 'Not found' }, 404)
  return null
}

// A contributor may only write into their own tutorial's folder — storage RLS
// (032_scope_upload_buckets_to_owner.sql) enforces the same rule, this is the
// app-layer half of the same defence-in-depth convention as the toy checks below.
async function checkTutorialContributor(c: Ctx, supabase: UserClient, tutorialId: string) {
  const { data, error } = await supabase
    .from('tutorial_contributors')
    .select('tutorial_id')
    .eq('tutorial_id', tutorialId)
    .eq('profile_id', c.get('userId'))
    .maybeSingle()
  return denied(c, data, error)
}

// Bucket RLS (Task 1) already scopes writes to the owner, but every other
// owner-scoped route in this codebase also checks explicitly (defence in depth).
//
// "Owner" includes a leader of the owning organisation since 033. Without that
// arm an org's stock could never be published at all: publishing requires a
// cover photo, and this is the only way one gets uploaded.
async function checkToyOwner(c: Ctx, supabase: UserClient, toyId: string) {
  const userId = c.get('userId')
  const { data, error } = await supabase
    .from('toys')
    .select('id')
    .eq('id', toyId)
    .or(ownedByCaller(userId, await ledOrgIds(supabase, userId)))
    .maybeSingle()
  return denied(c, data, error)
}

/** The two file-only buckets: same flow, different bucket and object path. */
function fileRoute(bucket: string, objectPath: (id: string, file: File) => string, withName: boolean) {
  return async (c: Ctx) => {
    const read = await readUpload(c, 'tutorialId')
    if (read instanceof Response) return read
    const [file, tutorialId] = read

    const supabase = createUserClient(c.get('token'))
    const no = await checkTutorialContributor(c, supabase, tutorialId)
    if (no) return no

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(objectPath(tutorialId, file), file, { upsert: true })
    if (error) return c.json({ error: error.message }, 500)

    // The object path, not a URL: these buckets have been private since 049, and
    // the web serves them through /files/<bucket>/<path> with a signed URL minted
    // per click. The key stays `url` so the editor is unchanged.
    return withName ? c.json({ url: data.path, filename: file.name }) : c.json({ url: data.path })
  }
}

upload.post('/pdf', fileRoute('tutorial-pdfs', (id) => `${id}/tutorial.pdf`, false))
upload.post('/stl', fileRoute('stl-files', (id, file) => `${id}/${file.name}`, true))

upload.post('/photo', async (c) => {
  const read = await readUpload(c, 'tutorialId')
  if (read instanceof Response) return read
  const [file, tutorialId] = read

  const userClient = createUserClient(c.get('token'))
  const no = await checkTutorialContributor(c, userClient, tutorialId)
  if (no) return no

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

upload.post('/toy-cover', async (c) => {
  const read = await readUpload(c, 'toyId')
  if (read instanceof Response) return read
  const [file, toyId] = read

  const supabase = createUserClient(c.get('token'))
  const no = await checkToyOwner(c, supabase, toyId)
  if (no) return no

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
  const read = await readUpload(c, 'toyId')
  if (read instanceof Response) return read
  const [file, toyId] = read

  const supabase = createUserClient(c.get('token'))
  const no = await checkToyOwner(c, supabase, toyId)
  if (no) return no

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
