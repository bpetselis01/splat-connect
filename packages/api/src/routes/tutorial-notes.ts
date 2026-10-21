/**
 * Community notes (093). Reads are public (routes/public.ts); these are the
 * writes. A note goes in through the caller's client, so RLS stamps whose it
 * is and refuses an unpublished guide. Pinning goes through the service role
 * after an is_tutorial_contributor check — RLS gives contributors no update.
 */
import { Hono, type Context } from 'hono'
import { createUserClient, createAdminClient } from '../supabase/client.js'
import { notify } from '../notify.js'
import type { AuthVariables } from '../middleware/auth.js'
import { toyPhotoUrl } from '../photo-storage.js'

const notes = new Hono<{ Variables: AuthVariables }>()
type Ctx = Context<{ Variables: AuthVariables }>

const GHOST = '00000000-0000-4000-8000-00000000dead'
const NOTE_COLUMNS = 'id, tutorial_id, step_position, author_id, body, photo_path, photo_caption, pinned_at, pinned_by, created_at'
// A note's photo is the toy-photos path /api/upload/note-photo wrote for this
// guide — the same rule as 093's tutorial_notes_photo_path_check.
const ownNotePhoto = (path: string, id: string) =>
  path.startsWith(`${id}/notes/`) && /^[0-9a-f-]{36}\.(jpg|png|webp|avif|heic|heif)$/.test(path.slice(`${id}/notes/`.length))


export function noteError(b: Record<string, unknown>, id: string): string | null {
  const body = typeof b.body === 'string' ? b.body.trim() : ''
  if (!body || body.length > 1000) return 'Say what you found, in 1000 characters or fewer.'
  const at = b.step_position
  if (at != null && !(Number.isInteger(at) && (at as number) >= 1 && (at as number) <= 60)) return 'Pick a step, or Missing step.'
  if (b.photo_path != null && (typeof b.photo_path !== 'string' || !ownNotePhoto(b.photo_path, id))) return 'That photo was not uploaded to this guide.'
  if (b.photo_caption != null && (typeof b.photo_caption !== 'string' || b.photo_caption.trim().length > 60)) return 'The photo caption is over 60 characters.'
  return null
}

/** Tell the guide's contributors. Logged, never thrown — the note is saved. */
async function notifyContributors(tutorialId: string, authorId: string) {
  const admin = createAdminClient()
  const [{ data: guide }, { data: who }] = await Promise.all([
    admin.from('tutorials').select('title, tutorial_contributors(profile_id)').eq('id', tutorialId).single(),
    admin.from('profiles').select('name').eq('id', authorId).single(),
  ])
  const recipients = ((guide?.tutorial_contributors ?? []) as { profile_id: string }[])
    .map((r) => r.profile_id)
    .filter((p) => p !== authorId && p !== GHOST)
  if (!recipients.length) return
  await notify(
    recipients.map((recipient_id) => ({
      recipient_id,
      type: 'tutorial_noted',
      tutorial_id: tutorialId,
      tutorial_title: guide?.title ?? null,
      actor_name: who?.name || 'A member',
    })),
    'tutorial-notes.noted'
  )
}

notes.post('/:id/notes', async (c) => {
  const id = c.req.param('id')
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  const invalid = noteError(b, id)
  if (invalid) return c.json({ error: invalid }, 400)
  const { data, error } = await createUserClient(c.get('token'))
    .from('tutorial_notes')
    .insert({
      tutorial_id: id,
      author_id: c.get('userId'),
      step_position: (b.step_position as number | null) ?? null,
      body: (b.body as string).trim(),
      photo_path: (b.photo_path as string | null) ?? null,
      photo_caption: (b.photo_caption as string | null)?.trim() || null,
    })
    .select(NOTE_COLUMNS)
    .single()
  // 42501: RLS refused — the guide is not published. 22P02: not a uuid.
  if (error && ['42501', '22P02'].includes(error.code)) return c.json({ error: 'Not found' }, 404)
  if (error) return c.json({ error: error.message }, 500)
  await notifyContributors(id, c.get('userId'))
  return c.json({ ...data, photo_url: toyPhotoUrl(data.photo_path) }, 201)
})

notes.delete('/:id/notes/:noteId', async (c) => {
  // RLS admits the note's author and admins; anyone else matches zero rows.
  const { data, error } = await createUserClient(c.get('token'))
    .from('tutorial_notes')
    .delete()
    .eq('id', c.req.param('noteId'))
    .eq('tutorial_id', c.req.param('id'))
    .select('id')
  if (error && error.code !== '22P02') return c.json({ error: error.message }, 500)
  if (!data?.length) return c.json({ error: 'Not found' }, 404)
  return c.body(null, 204)
})

async function setPin(c: Ctx, pinned: boolean) {
  const id = c.req.param('id')
  const { data: own } = await createUserClient(c.get('token')).rpc('is_tutorial_contributor', { p_tutorial_id: id })
  if (!own && c.get('role') !== 'admin') return c.json({ error: "Only the guide's authors can pin a note" }, 403)
  const { data, error } = await createAdminClient()
    .from('tutorial_notes')
    .update(pinned ? { pinned_at: new Date().toISOString(), pinned_by: c.get('userId') } : { pinned_at: null, pinned_by: null })
    .eq('id', c.req.param('noteId'))
    .eq('tutorial_id', id)
    .select('id')
  if (error && error.code !== '22P02') return c.json({ error: error.message }, 500)
  if (!data?.length) return c.json({ error: 'Not found' }, 404)
  return c.json({ pinned })
}

notes.post('/:id/notes/:noteId/pin', (c) => setPin(c, true))
notes.post('/:id/notes/:noteId/unpin', (c) => setPin(c, false))

export default notes
