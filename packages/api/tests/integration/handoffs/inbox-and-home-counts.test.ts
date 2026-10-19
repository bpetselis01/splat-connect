import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader, cleanupOrg, createProject } from '../../helpers/orgs.js'

/**
 * What the Today card and the inbox read, and what the inbox's own taps change.
 * Each assertion is the number a person would see in the badge.
 */
let user: TestUser
let other: TestUser
let orgId: string
let tutorialId: string
const authed = (t: TestUser, method = 'GET', body?: unknown) => ({
  method,
  headers: { Authorization: `Bearer ${t.token}`, 'Content-Type': 'application/json' },
  ...(body ? { body: JSON.stringify(body) } : {}),
})
const unread = async (t: TestUser) =>
  (await (await app.request('/api/notifications/me/unread-counts', authed(t))).json()) as Record<string, number>
const seed = async (recipient: string, type: string, extra: Record<string, unknown> = {}) => {
  const { data, error } = await adminClient()
    .from('notifications')
    .insert({ recipient_id: recipient, type, actor_name: 'SPLAT', tutorial_id: tutorialId, ...extra })
    .select('id')
    .single()
  if (error) throw error
  return data!.id as string
}

beforeAll(async () => {
  ;[user, other] = await Promise.all([createTestUser(), createTestUser()])
  tutorialId = await createProject({ authorId: user.id, status: 'draft' })
})

afterAll(async () => {
  if (orgId) await cleanupOrg(orgId)
  await adminClient().from('notifications').delete().in('recipient_id', [user.id, other.id])
  await adminClient().from('tutorials').delete().eq('id', tutorialId)
  await Promise.all([user, other].map((u) => deleteTestUser(u.id)))
})

describe('H01 the Today card reads', () => {
  it('H01 shows who I am, no organisation, no action, no unread, until something happens', async () => {
    const me = (await (await app.request('/api/contributors/me', authed(user))).json()) as { id: string }
    expect(me.id).toBe(user.id)
    expect(await (await app.request('/api/organizations/mine', authed(user))).json()).toEqual([])
    expect(await (await app.request('/api/toy-transactions/action-count', authed(user))).json()).toMatchObject({ count: 0 })
    expect(await unread(user)).toEqual({ tutorials: 0, exchanges: 0, challenges: 0, organisations: 0, total: 0 })
  })

  it('H01 then leading an organisation and a new notification show up on the next read', async () => {
    orgId = await createOrg({ createdBy: user.id, name: `Today ${Date.now()}` })
    await addLeader(orgId, user.id)
    const orgs = (await (await app.request('/api/organizations/mine', authed(user))).json()) as { id: string }[]
    expect(orgs.map((o) => o.id)).toEqual([orgId])

    await seed(user.id, 'tutorial_approved')
    await seed(user.id, 'toy_message')
    expect(await unread(user)).toMatchObject({ tutorials: 1, exchanges: 1, total: 2 })
  })
})

describe('Q07 a bucket Mark read', () => {
  it('Q07 WD22 WX01 WT37 clears that bucket and its share of the total, leaves the others and other people alone', async () => {
    await seed(user.id, 'idea_approved')
    await seed(other.id, 'tutorial_approved')
    expect(await unread(user)).toMatchObject({ tutorials: 1, challenges: 1, exchanges: 1, total: 3 })

    const res = await app.request('/api/notifications/me/read', authed(user, 'POST', { bucket: 'tutorials' }))
    expect(res.status).toBe(204)
    expect(await unread(user)).toMatchObject({ tutorials: 0, challenges: 1, exchanges: 1, total: 2 })
    expect(await unread(other)).toMatchObject({ tutorials: 1, total: 1 })
  })

  it('refuses a bucket that does not exist', async () => {
    const res = await app.request('/api/notifications/me/read', authed(user, 'POST', { bucket: 'everything' }))
    expect(res.status).toBe(400)
    expect(await unread(user)).toMatchObject({ total: 2 })
  })
})

describe('Q10 opening an exchange thread card', () => {
  it("Q10 WD38 WD39 marking each of the thread's notifications read drops the exchanges count by exactly that many", async () => {
    const before = (await unread(user)).exchanges
    const ids = [await seed(user.id, 'toy_message'), await seed(user.id, 'toy_message')]
    expect((await unread(user)).exchanges).toBe(before + 2)

    for (const id of ids) {
      expect((await app.request(`/api/notifications/${id}`, authed(user, 'PATCH', { read: true }))).status).toBe(204)
    }
    expect((await unread(user)).exchanges).toBe(before)
  })

  it("cannot clear someone else's notification", async () => {
    const id = await seed(other.id, 'toy_message')
    expect((await app.request(`/api/notifications/${id}`, authed(user, 'PATCH', { read: true }))).status).toBe(403)
    expect((await unread(other)).exchanges).toBe(1)
  })
})
