/**
 * File uploads (PDFs, toy photos, STL models) into Supabase Storage. Web
 * never talks to Storage directly — it posts here and stores the returned
 * public URL in the draft until tutorial submission.
 */
import { Hono, type Context } from 'hono'
import { MAX_PHOTOS } from '@splat-connect/types'
import { createUserClient } from '../supabase/client.js'
import { INVALID_TEXT_REPRESENTATION } from '../supabase/pg-errors.js'
import { ledOrgIds, ownedByCaller } from '../toy-access.js'
import type { AuthVariables } from '../middleware/auth.js'

const upload = new Hono<{ Variables: AuthVariables }>()

type Ctx = Context<{ Variables: AuthVariables }>
type UserClient = ReturnType<typeof createUserClient>

/** Mirrors 053's allowed_mime_types on both photo buckets. */
const PHOTO_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
/** Mirrors 053's file_size_limit on both photo buckets. */
const PHOTO_MAX_BYTES = 10 * 1024 * 1024

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

/**
 * A photo appended to an entity's gallery. Both photo buckets work this way
 * since 053: a uuid per file, nothing overwritten, up to MAX_PHOTOS of them.
 *
 * The route this replaced deleted every existing file before writing, so a
 * tutorial could only ever hold one photo. That delete WAS the cap; removing
 * it is what the cap below is for.
 */
function photoRoute(
  bucket: string,
  idField: 'tutorialId' | 'toyId',
  table: 'tutorials' | 'toys',
  check: (c: Ctx, supabase: UserClient, id: string) => Promise<Response | null>
) {
  return async (c: Ctx) => {
    const read = await readUpload(c, idField)
    if (read instanceof Response) return read
    const [file, id] = read

    // 053 set the same two limits on the bucket, so this is not the only guard
    // — it is the one that can say what to do about it. Storage answers a
    // rejected upload with "mime type application/pdf is not supported", which
    // is a sentence about the bucket rather than about the photo.
    if (!PHOTO_MIME.includes(file.type)) {
      return c.json({ error: 'Photos need to be a JPEG, PNG, WebP or HEIC image.' }, 400)
    }
    if (file.size > PHOTO_MAX_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1)
      return c.json({ error: `That photo is ${mb} MB — photos need to be under 10 MB.` }, 400)
    }

    const supabase = createUserClient(c.get('token'))
    const no = await check(c, supabase, id)
    if (no) return no

    // Counted before the upload rather than left to the PATCH that follows: a
    // sixth photo rejected after it had been written would leave the object
    // orphaned in the bucket with nothing pointing at it.
    const { data: row, error: countError } = await supabase
      .from(table)
      .select('photo_urls')
      .eq('id', id)
      .maybeSingle()
    if (countError) return c.json({ error: countError.message }, 500)
    if ((row?.photo_urls?.length ?? 0) >= MAX_PHOTOS) {
      return c.json(
        { error: `${MAX_PHOTOS} photos is the limit. Remove one to add another.` },
        400
      )
    }

    const ext = file.name.split('.').pop() ?? 'jpg'
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(`${id}/${crypto.randomUUID()}.${ext}`, file, { upsert: false })
    if (error) return c.json({ error: error.message }, 500)

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path)
    return c.json({ url: urlData.publicUrl })
  }
}

upload.post('/photo', photoRoute('toy-photos', 'tutorialId', 'tutorials', checkTutorialContributor))
upload.post('/toy-photo', photoRoute('toy-photos-library', 'toyId', 'toys', checkToyOwner))

export default upload
