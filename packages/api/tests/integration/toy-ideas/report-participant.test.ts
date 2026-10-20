/**
 * Reporting a challenge participant hides them from the reporter only. An
 * admin's PATCH /api/admin/reports/:id decides: 'remove' removes them,
 * 'dismiss' un-hides them. Nothing is removed by the report itself.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let author: TestUser
let reporter: TestUser
let reported: TestUser
let bystander: TestUser
let admin: TestUser
let ideaId: string

const call = (u: TestUser, path: string, method = 'GET', body?: unknown) =>
  app.request(path, {
    method,
    headers: { Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
const thread = async (u: TestUser) =>
  ((await (await call(u, `/api/ideas/${ideaId}/messages`)).json()) as Array<{ sender_id: string; kind: string; body: string }>)
const userSenders = async (u: TestUser) => (await thread(u)).filter((m) => m.kind === 'user').map((m) => m.sender_id)
const fileReport = () => call(reporter, `/api/ideas/${ideaId}/reports`, 'POST', { reported_profile_id: reported.id, reason: 'Made me uncomfortable' })
const openReport = async () =>
  (await adminClient().from('toy_idea_reports').select('id').eq('idea_id', ideaId).eq('reported_by', reporter.id).is('resolved_at', null).single()).data!.id as string
const participant = async () =>
  (await adminClient().from('toy_idea_participants').select('removed_at, removed_by').eq('idea_id', ideaId).eq('profile_id', reported.id).single()).data!
const removalNotices = async () =>
  (await adminClient().from('notifications').select('actor_name').eq('idea_id', ideaId).eq('recipient_id', reported.id).eq('type', 'challenge_removed')).data!

beforeAll(async () => {
  ;[author, reporter, reported, bystander, admin] = await Promise.all([
    createTestUser('contributor'), createTestUser('contributor'), createTestUser('contributor'),
    createTestUser('contributor'), createTestUser('admin'),
  ])
  ideaId = (
    await adminClient().from('toy_ideas').insert({ author_id: author.id, title: 'T', summary: 'S', status: 'challenge' }).select('id').single()
  ).data!.id
  await adminClient().from('toy_idea_participants').insert([reporter, reported, bystander].map((u) => ({ idea_id: ideaId, profile_id: u.id })))
  await adminClient().from('toy_idea_messages').insert(
    [reporter, reported, bystander].map((u) => ({ idea_id: ideaId, sender_id: u.id, kind: 'user', body: `from ${u.id}` })),
  )
})

afterAll(async () => {
  await adminClient().from('toy_ideas').delete().eq('id', ideaId) // cascades reports, participants, messages, notifications
  await Promise.all([author, reporter, reported, bystander, admin].map((u) => deleteTestUser(u.id)))
})

describe('reporting a participant', () => {
  it('C16 WI20 stores the report, hides them from the reporter only, and tells nobody', async () => {
    expect(await userSenders(reporter)).toContain(reported.id)
    expect((await fileReport()).status).toBe(201)
    const stored = (await adminClient().from('toy_idea_reports').select('reason, reported_by, reported_profile_id').eq('idea_id', ideaId).eq('reported_by', reporter.id).eq('reported_profile_id', reported.id)).data!
    expect(stored).toEqual([{ reason: 'Made me uncomfortable', reported_by: reporter.id, reported_profile_id: reported.id }])
    const notices = (await adminClient().from('notifications').select('id').eq('idea_id', ideaId).eq('recipient_id', reported.id)).data!
    expect(notices).toHaveLength(0)

    expect(await userSenders(reporter)).not.toContain(reported.id)
    expect(await userSenders(reporter)).toContain(bystander.id)
    expect(await userSenders(bystander)).toContain(reported.id)
    expect(await userSenders(author)).toContain(reported.id)
    expect((await participant()).removed_at).toBeNull()
    expect(await removalNotices()).toHaveLength(0)
  })

  it('stays open: reporting the author does not remove the reporter', async () => {
    const res = await call(reporter, `/api/ideas/${ideaId}/reports`, 'POST', { reported_profile_id: author.id, reason: 'Also this' })
    expect(res.status).toBe(201)
    const { data } = await adminClient().from('toy_idea_participants').select('removed_at').eq('idea_id', ideaId).eq('profile_id', reporter.id).single()
    expect(data!.removed_at).toBeNull()
    await adminClient().from('toy_idea_reports').delete().eq('idea_id', ideaId).eq('reported_profile_id', author.id)
  })

  it("'dismiss' un-hides them for the reporter and removes nobody", async () => {
    const id = await openReport()
    expect((await call(admin, `/api/admin/reports/${id}`, 'PATCH', { action: 'dismiss' })).status).toBe(200)
    expect(await userSenders(reporter)).toContain(reported.id)
    expect((await participant()).removed_at).toBeNull()
    expect(await removalNotices()).toHaveLength(0)
  })

  it("'remove' removes them, posts the system message and notifies once; a second resolve acts once", async () => {
    expect((await fileReport()).status).toBe(201)
    const id = await openReport()

    const first = await call(admin, `/api/admin/reports/${id}`, 'PATCH', { action: 'remove', resolution_note: 'Confirmed' })
    expect(first.status).toBe(200)
    expect(await participant()).toMatchObject({ removed_by: admin.id })
    expect((await participant()).removed_at).toBeTruthy()
    expect((await removalNotices()).map((n) => n.actor_name)).toEqual(['SPLAT'])
    const messages = (await adminClient().from('toy_idea_messages').select('body').eq('idea_id', ideaId).eq('kind', 'system')).data!
    expect(messages.filter((m) => m.body.endsWith('was removed from this challenge'))).toHaveLength(1)

    const second = await call(admin, `/api/admin/reports/${id}`, 'PATCH', { action: 'remove' })
    expect(second.status).toBe(404)
    expect(await removalNotices()).toHaveLength(1)
  })

  it("refuses 'remove' on a report against the author and leaves it open", async () => {
    const { data } = await adminClient().from('toy_idea_reports')
      .insert({ idea_id: ideaId, reported_profile_id: author.id, reported_by: bystander.id, reason: 'r' }).select('id').single()
    const res = await call(admin, `/api/admin/reports/${data!.id}`, 'PATCH', { action: 'remove' })
    expect(res.status).toBe(409)
    const after = await adminClient().from('toy_idea_reports').select('resolved_at').eq('id', data!.id).single()
    expect(after.data!.resolved_at).toBeNull()
  })
})
