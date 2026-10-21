/**
 * GET /api/notifications/me/unread-counts: each hub card's badge, driven by
 * the real action that notifies and cleared by the card's Mark read. Every
 * test starts from an account that has never been told anything.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { MARK_BUCKET_READ_PATH } from '@splat-connect/types'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader, createProject, cleanupOrg } from '../../helpers/orgs.js'
import { call, ok, publishedToy } from './api.js'

type Unread = { tutorials: number; exchanges: number; challenges: number; organisations: number; total: number }
const ZERO: Unread = { tutorials: 0, exchanges: 0, challenges: 0, organisations: 0, total: 0 }
const unread = async (who: TestUser) => (await (await call(who, 'GET', '/notifications/me/unread-counts')).json()) as Unread
const markRead = async (who: TestUser, bucket: string) => expect((await call(who, 'POST', '/notifications/me/read', { bucket })).status).toBe(204)

let admin: TestUser
let family: TestUser
const cleanup: Array<() => Promise<unknown>> = []

beforeAll(async () => {
  ;[admin, family] = await Promise.all([createTestUser('admin'), createTestUser('contributor')])
})
afterAll(async () => {
  for (const fn of cleanup.reverse()) await fn()
  await Promise.all([admin, family].map((u) => deleteTestUser(u.id)))
})

const fresh = async () => {
  const u = await createTestUser('contributor')
  cleanup.push(() => deleteTestUser(u.id))
  return u
}

describe('the hub badges', () => {
  it('counts:unread-counts.tutorials rises by one when a family thanks the guide, and Mark read on Guides clears it', async () => {
    const author = await fresh()
    const guide = await createProject({ authorId: author.id, status: 'approved' })
    cleanup.push(async () => { await adminClient().from('tutorials').delete().eq('id', guide) })
    expect(await unread(author)).toEqual(ZERO)

    await ok(family, 'POST', `/tutorials/${guide}/thanks`)
    expect(await unread(author)).toEqual({ ...ZERO, tutorials: 1, total: 1 })

    await markRead(author, 'tutorials')
    expect(await unread(author)).toEqual(ZERO)
  })

  it('counts:unread-counts.exchanges rises by one when a family asks for the toy, and Mark read on Exchanges clears it', async () => {
    const owner = await fresh()
    const toyId = await publishedToy(owner, 'Counted truck')
    expect(await unread(owner)).toEqual(ZERO)

    await ok(family, 'POST', '/toy-transactions', { toy_id: toyId, type: 'donation' })
    expect(await unread(owner)).toEqual({ ...ZERO, exchanges: 1, total: 1 })

    await markRead(owner, 'exchanges')
    expect(await unread(owner)).toEqual(ZERO)
  })

  it('counts:unread-counts.challenges rises by one when an admin publishes the idea, and Mark read on Challenges clears it', async () => {
    const author = await fresh()
    expect(await unread(author)).toEqual(ZERO)
    const idea = await ok(author, 'POST', '/ideas', { title: 'A counted switch', summary: 'Easier to press' })
    cleanup.push(async () => { await adminClient().from('toy_ideas').delete().eq('id', idea.id) })
    expect(await unread(author)).toEqual({ ...ZERO, challenges: 1, total: 1 })
    await markRead(author, 'challenges')
    expect(await unread(author)).toEqual(ZERO)

    await ok(admin, 'PATCH', `/admin/ideas/${idea.id}/status`, { status: 'challenge' })
    expect(await unread(author)).toEqual({ ...ZERO, challenges: 1, total: 1 })

    await markRead(author, 'challenges')
    expect(await unread(author)).toEqual(ZERO)
  })

  it('counts:unread-counts.organisations rises by one when a family thanks the organisation, and opening the hub clears it', async () => {
    const leader = await fresh()
    const orgId = await createOrg({ createdBy: leader.id })
    await addLeader(orgId, leader.id)
    cleanup.push(() => cleanupOrg(orgId))
    expect(await unread(leader)).toEqual(ZERO)

    await ok(family, 'POST', `/organizations/${orgId}/thanks`, { note: 'Thank you', byline: 'Sam' })
    expect(await unread(leader)).toEqual({ ...ZERO, organisations: 1, total: 1 })

    await ok(family, 'POST', `/organizations/${orgId}/conversations/mine/messages`, { body: 'Can we visit?' })
    expect(await unread(leader)).toEqual({ ...ZERO, organisations: 2, total: 2 })

    // The request MarkNotificationsRead sends when the hub opens, not a call the page never makes.
    const hubOpen = await call(leader, 'POST', MARK_BUCKET_READ_PATH.replace(/^\/api/, ''), { bucket: 'organisations' })
    expect(hubOpen.status).toBe(204)
    expect(await unread(leader)).toEqual(ZERO)
  })
})
