/**
 * 106: an idea may carry one photo, uploaded before the idea exists and filed
 * under its author. The column holds a toy-photos PATH, never a URL; every
 * read builds photo_url. Only a path in the author's own ideas/ folder is
 * taken — by the API (400) and by toy_ideas_photo_path_check (23514).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import app from '../../../src/app.js'
import { createUserClient } from '../../../src/supabase/client.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let author: TestUser
let other: TestUser
let reviewer: TestUser
const ids: string[] = []
// A 1×1 PNG.
const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='),
  (ch) => ch.charCodeAt(0)
)
const publicUrl = (path: string) => `${process.env.SUPABASE_URL}/storage/v1/object/public/toy-photos/${path}`

const upload = (u: TestUser, file = new File([PNG], '../../evil.svg', { type: 'image/png' })) => {
  const form = new FormData()
  form.append('file', file)
  return app.request('/api/upload/idea-photo', { method: 'POST', headers: { Authorization: `Bearer ${u.token}` }, body: form })
}
const post = (u: TestUser, body: unknown) =>
  app.request('/api/ideas', {
    method: 'POST',
    headers: { Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
const get = (path: string, u?: TestUser) =>
  app.request(path, u ? { headers: { Authorization: `Bearer ${u.token}` } } : {})

beforeAll(async () => {
  author = await createTestUser('contributor')
  other = await createTestUser('contributor')
  reviewer = await createTestUser('admin')
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('toy_ideas').delete().in('id', ids)
  for (const u of [author, other]) {
    const { data } = await admin.storage.from('toy-photos').list(`ideas/${u.id}`)
    if (data?.length) await admin.storage.from('toy-photos').remove(data.map((f) => `ideas/${u.id}/${f.name}`))
  }
  for (const u of [author, other, reviewer]) await deleteTestUser(u.id)
})

describe('106 idea photo', () => {
  let path: string
  let ideaId: string

  it('uploads into the author’s folder, naming the file from its type, never its filename', async () => {
    const res = await upload(author)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { path: string; url: string }
    path = body.path
    expect(path).toMatch(new RegExp(`^ideas/${author.id}/[0-9a-f-]{36}\\.png$`))
    expect(body.url).toBe(publicUrl(path))
    expect((await fetch(body.url)).status).toBe(200)
  })

  it('refuses a file that is not a photo', async () => {
    const res = await upload(author, new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' }))
    expect(res.status).toBe(400)
  })

  it('keeps the path on the idea and reads it back as a URL, to the author and to an admin', async () => {
    const res = await post(author, { title: 'T', summary: 'S', photo_path: path })
    expect(res.status).toBe(201)
    const row = (await res.json()) as { id: string; photo_path: string; photo_url: string }
    ideaId = row.id
    ids.push(ideaId)
    expect(row).toMatchObject({ photo_path: path, photo_url: publicUrl(path) })

    const mine = (await (await get('/api/ideas/mine', author)).json()) as { id: string; photo_url: string | null }[]
    expect(mine.find((i) => i.id === ideaId)!.photo_url).toBe(publicUrl(path))

    const queue = (await (await get('/api/admin/ideas', reviewer)).json()) as { id: string; photo_url: string | null }[]
    expect(queue.find((i) => i.id === ideaId)!.photo_url).toBe(publicUrl(path))
  })

  it('stores no photo when none is sent', async () => {
    const res = await post(author, { title: 'T', summary: 'S' })
    const row = (await res.json()) as { id: string; photo_path: string | null; photo_url: string | null }
    ids.push(row.id)
    expect(row).toMatchObject({ photo_path: null, photo_url: null })
  })

  it('serves a published challenge’s photo as a URL on the detail and the list', async () => {
    await adminClient().from('toy_ideas').update({ status: 'challenge' }).eq('id', ideaId)
    const detail = (await (await get(`/api/public/challenges/${ideaId}`)).json()) as { photo_url: string | null }
    expect(detail.photo_url).toBe(publicUrl(path))
    const list = (await (await get('/api/public/challenges')).json()) as { id: string; photo_url: string | null }[]
    expect(list.find((i) => i.id === ideaId)!.photo_url).toBe(publicUrl(path))
  })

  it('lets anon read photo_path, and still never review_note', async () => {
    const anon = createClient(process.env.SUPABASE_URL ?? 'http://localhost:54321', process.env.SUPABASE_ANON_KEY ?? '')
    const { data, error } = await anon.from('toy_ideas').select('photo_path').eq('id', ideaId).single()
    expect(error).toBeNull()
    expect(data!.photo_path).toBe(path)
    expect((await anon.from('toy_ideas').select('review_note').eq('id', ideaId)).error).not.toBeNull()
  })

  const leaf = `${crypto.randomUUID()}.jpg`
  const outsiders = () => [
    `https://evil.example/storage/v1/object/public/toy-photos/ideas/${author.id}/${leaf}`,
    publicUrl(`ideas/${author.id}/${leaf}`),
    `ideas/${other.id}/${leaf}`,
    `ideas/${author.id}/../${other.id}/${leaf}`,
  ]

  it('refuses an absolute URL or another member’s folder, in plain words', async () => {
    for (const photo_path of [...outsiders(), 42]) {
      const res = await post(author, { title: 'T', summary: 'S', photo_path })
      expect(res.status).toBe(400)
      expect(((await res.json()) as { error: string }).error).toBe('That photo was not uploaded from this account.')
    }
  })

  it('refuses the same on a direct insert or update', async () => {
    const db = createUserClient(author.token).from('toy_ideas')
    for (const photo_path of outsiders()) {
      const { error } = await db.insert({ author_id: author.id, title: 'T', summary: 'S', status: 'pending', photo_path })
      expect(error?.code).toBe('23514')
    }
    const { data: pending } = await db
      .insert({ author_id: author.id, title: 'T', summary: 'S', status: 'pending' })
      .select('id')
      .single()
    ids.push(pending!.id)
    for (const photo_path of outsiders()) {
      const { error } = await db.update({ photo_path }).eq('id', pending!.id)
      expect(error?.code).toBe('23514')
    }
    const { error } = await db.update({ photo_path: `ideas/${author.id}/${leaf}` }).eq('id', pending!.id)
    expect(error).toBeNull()
  })
})
