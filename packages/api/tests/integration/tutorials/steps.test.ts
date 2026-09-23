import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'

let author: TestUser
let stranger: TestUser
let guide: string

const put = (token: string, steps: unknown) =>
  app.request(`/api/tutorials/${guide}/steps`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ steps }),
  })

beforeAll(async () => {
  author = await createTestUser('contributor')
  stranger = await createTestUser('contributor')
  guide = await createProject({ authorId: author.id, status: 'approved', title: 'Steps Fixture' })
})

afterAll(async () => {
  const admin = adminClient()
  const { data: files } = await admin.storage.from('toy-photos').list(`${guide}/steps`)
  if (files?.length) await admin.storage.from('toy-photos').remove(files.map((f) => `${guide}/steps/${f.name}`))
  await admin.from('tutorials').delete().eq('id', guide)
  await deleteTestUser(author.id)
  await deleteTestUser(stranger.id)
})

describe('PUT /api/tutorials/:id/steps', () => {
  it('saves the steps in order, numbered 1..n', async () => {
    const res = await put(author.token, [{ title: 'Open it', body: 'Unscrew the back.' }, { body: '  Solder the leads.  ' }])
    expect(res.status).toBe(200)
    const steps = (await res.json()) as Array<{ position: number; title: string | null; body: string }>
    expect(steps.map((s) => [s.position, s.title, s.body])).toEqual([
      [1, 'Open it', 'Unscrew the back.'],
      [2, null, 'Solder the leads.'],
    ])
  })

  it('replaces the list rather than appending to it', async () => {
    const res = await put(author.token, [{ body: 'Only step' }])
    expect(res.status).toBe(200)
    const { data } = await adminClient().from('tutorial_steps').select('body').eq('tutorial_id', guide)
    expect(data).toEqual([{ body: 'Only step' }])
  })

  it('comes back ordered inside both detail responses', async () => {
    await put(author.token, [{ body: 'A' }, { body: 'B' }, { body: 'C' }])
    const own = await app.request(`/api/tutorials/${guide}`, { headers: { Authorization: `Bearer ${author.token}` } })
    expect(((await own.json()) as { steps: { body: string }[] }).steps.map((s) => s.body)).toEqual(['A', 'B', 'C'])
    const pub = await app.request(`/api/public/tutorials/${guide}`)
    expect(((await pub.json()) as { steps: { body: string }[] }).steps.map((s) => s.body)).toEqual(['A', 'B', 'C'])
  })

  it('refuses a stranger and leaves the steps alone', async () => {
    expect((await put(stranger.token, [{ body: 'Mine now' }])).status).toBe(403)
    expect((await put(stranger.token, [])).status).toBe(404)
    const { count } = await adminClient()
      .from('tutorial_steps')
      .select('id', { count: 'exact', head: true })
      .eq('tutorial_id', guide)
    expect(count).toBe(3)
  })

  it('validates lengths, the count, and where a photo lives', async () => {
    expect((await put(author.token, [{ body: '   ' }])).status).toBe(400)
    expect((await put(author.token, [{ body: 'x'.repeat(2001) }])).status).toBe(400)
    expect((await put(author.token, [{ title: 't'.repeat(121), body: 'ok' }])).status).toBe(400)
    expect((await put(author.token, Array.from({ length: 61 }, () => ({ body: 'ok' })))).status).toBe(400)
    const elsewhere = `http://127.0.0.1:54321/storage/v1/object/public/toy-photos/${crypto.randomUUID()}/x.jpg`
    expect((await put(author.token, [{ body: 'ok', photo_url: elsewhere }])).status).toBe(400)
  })

  it('clears every step with an empty list', async () => {
    const res = await put(author.token, [])
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })
})

describe('POST /api/upload/step-photo', () => {
  it('stores under <id>/steps/ without counting toward the five-photo gallery', async () => {
    await adminClient()
      .from('tutorials')
      .update({ photo_urls: ['a', 'b', 'c', 'd', 'e'] })
      .eq('id', guide)
    const fd = new FormData()
    fd.append('file', new File(['jpg-bytes'], 'step.jpg', { type: 'image/jpeg' }))
    fd.append('tutorialId', guide)
    const res = await app.request('/api/upload/step-photo', {
      method: 'POST',
      headers: { Authorization: `Bearer ${author.token}` },
      body: fd,
    })
    expect(res.status).toBe(200)
    const { url } = (await res.json()) as { url: string }
    expect(url).toContain(`/toy-photos/${guide}/steps/`)

    const saved = await put(author.token, [{ body: 'With a photo', photo_url: url }])
    expect(saved.status).toBe(200)
  })
})
