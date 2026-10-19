/**
 * The design challenge chain, one notification row per action: who is told,
 * what type, and which idea it opens (idea_id is the link target; mobile opens
 * the public brief, except idea_rejected, which has none and opens "my ideas").
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { nameUser } from '../../helpers/notifications.js'

let author: TestUser
let maker: TestUser
let admin: TestUser
const ideaIds: string[] = []

const call = (token: string, method: string, path: string, body?: unknown) =>
  app.request(`/api${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

async function submitIdea() {
  const res = await call(author.token, 'POST', '/ideas', { title: 'A better switch', summary: 'Easier to press' })
  expect(res.status).toBe(201)
  const id = ((await res.json()) as { id: string }).id
  ideaIds.push(id)
  return id
}
async function publish(id: string) {
  expect((await call(admin.token, 'PATCH', `/admin/ideas/${id}/status`, { status: 'challenge' })).status).toBe(200)
}
const notes = async (id: string) =>
  (
    await adminClient()
      .from('notifications')
      .select('recipient_id, type, idea_id, actor_name, body')
      .eq('idea_id', id)
      .order('created_at', { ascending: true })
  ).data ?? []

beforeAll(async () => {
  ;[author, maker, admin] = await Promise.all([
    createTestUser('contributor'),
    createTestUser('contributor'),
    createTestUser('admin'),
  ])
  await nameUser(author.id, 'Ada Author')
  await nameUser(maker.id, 'Max Maker')
})

afterAll(async () => {
  await adminClient().from('toy_ideas').delete().in('id', ideaIds)
  await Promise.all([author, maker, admin].map((u) => deleteTestUser(u.id)))
})

describe('the review of a submitted idea (C12)', () => {
  it('C12 publishing tells the author, in SPLAT’s name (idea_approved)', async () => {
    const id = await submitIdea()
    await publish(id)
    expect(await notes(id)).toEqual([
      { recipient_id: author.id, type: 'idea_approved', idea_id: id, actor_name: 'SPLAT', body: null },
    ])
  })

  it('C12 declining tells the author, with the reviewer’s note as the body (idea_rejected)', async () => {
    const id = await submitIdea()
    const res = await call(admin.token, 'PATCH', `/admin/ideas/${id}/status`, { status: 'rejected', review_note: 'Too close to one we have' })
    expect(res.status).toBe(200)
    expect(await notes(id)).toEqual([
      { recipient_id: author.id, type: 'idea_rejected', idea_id: id, actor_name: 'SPLAT', body: 'Too close to one we have' },
    ])
  })
})

describe('joining and leaving (C03, C04)', () => {
  it('C03 C04 WI16 WI19 joining tells the author; leaving tells the author; the author removing tells the maker (challenge_joined, challenge_left, challenge_removed)', async () => {
    const id = await submitIdea()
    await publish(id)

    expect((await call(maker.token, 'POST', `/ideas/${id}/join`, {})).status).toBe(201)
    expect((await notes(id)).filter((n) => n.type === 'challenge_joined')).toEqual([
      { recipient_id: author.id, type: 'challenge_joined', idea_id: id, actor_name: 'Max Maker', body: null },
    ])

    expect((await call(maker.token, 'DELETE', `/ideas/${id}/participants/${maker.id}`)).status).toBe(200)
    expect((await notes(id)).filter((n) => n.type === 'challenge_left')).toEqual([
      { recipient_id: author.id, type: 'challenge_left', idea_id: id, actor_name: 'Max Maker', body: null },
    ])

    await call(maker.token, 'POST', `/ideas/${id}/join`, {})
    expect((await call(author.token, 'DELETE', `/ideas/${id}/participants/${maker.id}`)).status).toBe(200)
    expect((await notes(id)).filter((n) => n.type === 'challenge_removed')).toEqual([
      { recipient_id: maker.id, type: 'challenge_removed', idea_id: id, actor_name: 'Ada Author', body: null },
    ])
  })
})
