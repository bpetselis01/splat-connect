/** 066 thanks: one per person per guide, never your own, only on a published guide. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'

let author: TestUser
let collab: TestUser
let family: TestUser
let guide: string
let draft: string
const call = (method: string, path: string, token: string) => app.request(path, { method, headers: { Authorization: `Bearer ${token}` } })
const thanks = (id: string) => `/api/tutorials/${id}/thanks`

beforeAll(async () => {
  author = await createTestUser('contributor')
  collab = await createTestUser('contributor')
  family = await createTestUser('contributor')
  guide = await createProject({ authorId: author.id, status: 'approved', title: 'Thanks Fixture' })
  draft = await createProject({ authorId: author.id, status: 'draft', title: 'Thanks Draft Fixture' })
  const { error } = await adminClient().from('tutorial_contributors').insert({ tutorial_id: guide, profile_id: collab.id, role: 'collaborator' })
  if (error) throw new Error(error.message)
})
afterAll(async () => {
  await adminClient().from('notifications').delete().eq('tutorial_id', guide)
  await adminClient().from('tutorials').delete().in('id', [guide, draft])
  for (const u of [author, collab, family]) await deleteTestUser(u.id)
})

describe('guide thanks against the real database', () => {
  it('reports not thanked, not own, before anything is sent', async () => {
    const res = await call('GET', thanks(guide), family.token)
    expect(await res.json()).toEqual({ thanked: false, own: false })
  })

  it('G09 WT09 records a thank, bumps the count, and notifies every credited contributor anonymously (tutorial_thanked)', async () => {
    const res = await call('POST', thanks(guide), family.token)
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ thanks_count: 1 })

    const { data } = await adminClient().from('notifications').select('recipient_id, type, tutorial_title, actor_name').eq('tutorial_id', guide)
    expect((data ?? []).map((n) => n.recipient_id).sort()).toEqual([author.id, collab.id].sort())
    for (const n of data ?? []) expect(n).toMatchObject({ type: 'tutorial_thanked', tutorial_title: 'Thanks Fixture', actor_name: 'A family' })
  })

  it('reports thanked afterwards, to the thanker only', async () => {
    expect(await (await call('GET', thanks(guide), family.token)).json()).toEqual({ thanked: true, own: false })
    expect(await (await call('GET', thanks(guide), collab.token)).json()).toEqual({ thanked: false, own: true })
  })

  it('refuses a second thank from the same person and leaves the count and notifications alone', async () => {
    expect((await call('POST', thanks(guide), family.token)).status).toBe(409)
    const { data } = await adminClient().from('tutorials').select('thanks_count').eq('id', guide).single()
    expect(data!.thanks_count).toBe(1)
    const { count } = await adminClient().from('notifications').select('id', { count: 'exact', head: true }).eq('tutorial_id', guide)
    expect(count).toBe(2)
  })

  it.each(['author', 'collaborator'])('refuses thanking your own guide as the %s', async (who) => {
    const token = who === 'author' ? author.token : collab.token
    expect((await call('POST', thanks(guide), token)).status).toBe(403)
  })

  it('treats an unapproved guide as not found for both verbs', async () => {
    expect((await call('POST', thanks(draft), family.token)).status).toBe(404)
    expect((await call('GET', thanks(draft), family.token)).status).toBe(404)
  })

  it('treats an unknown guide as not found', async () => {
    expect((await call('POST', thanks(crypto.randomUUID()), family.token)).status).toBe(404)
  })

  it('needs a signed-in member', async () => {
    expect((await app.request(`/api/tutorials/${guide}/thanks`, { method: 'POST' })).status).toBe(401)
  })
})
