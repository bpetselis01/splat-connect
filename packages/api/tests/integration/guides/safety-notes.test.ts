import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'

let author: TestUser
let stranger: TestUser
let guide: string
const post = (token: string, safety_notes: unknown) =>
  app.request(`/api/tutorials/${guide}/safety-notes`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ safety_notes }),
  })

beforeAll(async () => {
  author = await createTestUser('contributor')
  stranger = await createTestUser('contributor')
  guide = await createProject({ authorId: author.id, status: 'approved', title: 'Safety Notes Fixture' })
})
afterAll(async () => {
  await adminClient().from('tutorials').delete().eq('id', guide)
  await deleteTestUser(author.id)
  await deleteTestUser(stranger.id)
})

describe('090 tutorial_safety_notes', () => {
  it('exists', async () => {
    expect((await adminClient().from('tutorial_safety_notes').select('id, position, title, detail').limit(1)).error).toBeNull()
  })

  it('T12 saves the list in order and serves it in both detail reads', async () => {
    const res = await post(author.token, [
      { title: 'Fluid and electronics share the enclosure', detail: 'The relay must sit above the waterline.' },
      { title: 'Battery door must be screwed shut' },
    ])
    expect(res.status).toBe(201)
    const pub = (await (await app.request(`/api/public/tutorials/${guide}`)).json()) as { safety_notes: { position: number; title: string }[] }
    expect(pub.safety_notes.map((n) => [n.position, n.title])).toEqual([
      [1, 'Fluid and electronics share the enclosure'],
      [2, 'Battery door must be screwed shut'],
    ])
    const own = (await (await app.request(`/api/tutorials/${guide}`, { headers: { Authorization: `Bearer ${author.token}` } })).json()) as { safety_notes: unknown[] }
    expect(own.safety_notes).toHaveLength(2)
  })

  it('refuses a stranger, a blank or long title, and a 21st note — and changes nothing', async () => {
    expect((await post(stranger.token, [{ title: 'Mine now' }])).status).toBe(403)
    const blank = await post(author.token, [{ title: '  ' }])
    expect(((await blank.json()) as { error: string }).error).toBe('Safety note 1 needs a title')
    expect((await post(author.token, [{ title: 'x'.repeat(81) }])).status).toBe(400)
    expect((await post(author.token, [{ title: 'ok', detail: 'x'.repeat(501) }])).status).toBe(400)
    expect((await post(author.token, Array.from({ length: 21 }, () => ({ title: 'ok' })))).status).toBe(400)
    const { count } = await adminClient().from('tutorial_safety_notes').select('id', { count: 'exact', head: true }).eq('tutorial_id', guide)
    expect(count).toBe(2)
  })
})
