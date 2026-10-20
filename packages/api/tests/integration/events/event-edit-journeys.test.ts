/**
 * The edit screens for an event and a story: "Save changes" on a live item,
 * "Publish to ..." on a draft and "Save as draft", through the PATCH (and the
 * questions PUT) the screens send, with what each one tells followers and the
 * registered.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader } from '../../helpers/orgs.js'

let leader: TestUser
let follower: TestUser
let going: TestUser
let orgId: string

const send = (token: string, method: string, body: unknown) => ({
  method,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})
const at = (days: number) => new Date(Date.now() + days * 864e5).toISOString()
const eventBody = (over: Record<string, unknown> = {}) => ({
  title: 'Edit day', kind: 'build_day', starts_at: at(14), format: 'in_person', location: 'A hall, 1 Test St',
  suburb: 'Crows Nest', state: 'NSW', ...over,
})
const notesFor = async (userId: string, column: 'org_event_id' | 'org_story_id', id: string) =>
  ((await adminClient().from('notifications').select('type, tutorial_title, actor_name').eq('recipient_id', userId).eq(column, id)).data ?? [])
const createEvent = async (status: 'draft' | 'published') =>
  (await adminClient().from('org_events').insert({ ...eventBody(), org_id: orgId, created_by: leader.id, status }).select('id').single()).data!.id as string
const createStory = async (status: 'draft' | 'published') =>
  (await adminClient().from('org_stories').insert({
    org_id: orgId, created_by: leader.id, kind: 'family', title: 'Edit story', summary: 's', body: 'b', byline: 'A leader',
    consent_confirmed: true, status, published_at: status === 'published' ? new Date().toISOString() : null,
  }).select('id').single()).data!.id as string

beforeAll(async () => {
  ;[leader, follower, going] = await Promise.all([1, 2, 3].map(() => createTestUser('contributor')))
  orgId = await createOrg({ createdBy: leader.id, name: `Edit journeys ${Date.now()}` })
  await addLeader(orgId, leader.id)
  await adminClient().from('org_follows').insert({ org_id: orgId, profile_id: follower.id })
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('notifications').delete().in('recipient_id', [leader.id, follower.id, going.id])
  const { data: events } = await admin.from('org_events').select('id').eq('org_id', orgId)
  const ids = (events ?? []).map((e: { id: string }) => e.id)
  await admin.from('org_event_registrations').delete().in('event_id', ids)
  await admin.from('org_event_questions').delete().in('event_id', ids)
  await admin.from('org_events').delete().eq('org_id', orgId)
  await admin.from('org_stories').delete().eq('org_id', orgId)
  await admin.from('org_follows').delete().eq('org_id', orgId)
  await admin.from('org_leaders').delete().eq('org_id', orgId)
  await admin.from('organizations').delete().eq('id', orgId)
  await Promise.all([leader, follower, going].map((u) => deleteTestUser(u.id)))
})

describe('editing an event', () => {
  it('L35 Save as draft stores the edit and its questions and tells nobody; Publish to Events then tells each follower once', async () => {
    const id = await createEvent('draft')
    const patch = await app.request(`/api/organizations/${orgId}/events/${id}`, send(leader.token, 'PATCH', eventBody({ title: 'Edited draft', status: 'draft' })))
    expect(patch.status).toBe(200)
    const put = await app.request(`/api/organizations/${orgId}/events/${id}/questions`, send(leader.token, 'PUT', {
      questions: [{ prompt: 'Which toy?', answer_type: 'short', required: true }],
    }))
    expect(put.status).toBe(200)
    const admin = adminClient()
    expect((await admin.from('org_events').select('title, status').eq('id', id).single()).data).toEqual({ title: 'Edited draft', status: 'draft' })
    expect((await admin.from('org_event_questions').select('position, prompt, answer_type, required').eq('event_id', id)).data)
      .toEqual([{ position: 1, prompt: 'Which toy?', answer_type: 'short', required: true }])
    expect(await notesFor(follower.id, 'org_event_id', id)).toEqual([])

    const publish = await app.request(`/api/organizations/${orgId}/events/${id}`, send(leader.token, 'PATCH', eventBody({ title: 'Edited draft', status: 'published' })))
    expect(publish.status).toBe(200)
    expect((await admin.from('org_events').select('status').eq('id', id).single()).data!.status).toBe('published')
    expect(await notesFor(follower.id, 'org_event_id', id)).toEqual([
      { type: 'org_event_published', tutorial_title: 'Edited draft', actor_name: expect.stringContaining('Edit journeys') },
    ])
    expect(await notesFor(leader.id, 'org_event_id', id)).toEqual([])
    const listed = (await (await app.request(`/api/organizations/${orgId}/events`, { headers: { Authorization: `Bearer ${leader.token}` } })).json()) as Array<{ id: string; status: string }>
    expect(listed.find((e) => e.id === id)).toMatchObject({ status: 'published' })
  })

  it('L35 Save changes on a live event keeps surviving question ids, drops the removed, and tells the registered only when the time moves', async () => {
    const id = await createEvent('published')
    const admin = adminClient()
    const { data: qs } = await admin.from('org_event_questions').insert([
      { event_id: id, position: 1, prompt: 'Keep me', answer_type: 'short', required: false },
      { event_id: id, position: 2, prompt: 'Drop me', answer_type: 'short', required: false },
    ]).select('id, prompt')
    const keep = qs!.find((q: { prompt: string }) => q.prompt === 'Keep me')!.id
    await admin.from('org_event_registrations').insert({ event_id: id, user_id: going.id, name: 'Going', email: 'g@example.com', answers: {} })

    const same = eventBody({ title: 'Live day renamed', status: 'published' })
    // The screen sends the whole form, so the unchanged time must stay unchanged.
    const { data: before } = await admin.from('org_events').select('starts_at').eq('id', id).single()
    const renamed = await app.request(`/api/organizations/${orgId}/events/${id}`, send(leader.token, 'PATCH', { ...same, starts_at: before!.starts_at }))
    expect(renamed.status).toBe(200)
    const put = await app.request(`/api/organizations/${orgId}/events/${id}/questions`, send(leader.token, 'PUT', {
      questions: [{ id: keep, prompt: 'Keep me, reworded', answer_type: 'short', required: true }],
    }))
    expect(put.status).toBe(200)
    expect((await admin.from('org_event_questions').select('id, prompt, required').eq('event_id', id)).data)
      .toEqual([{ id: keep, prompt: 'Keep me, reworded', required: true }])
    expect((await admin.from('org_events').select('title').eq('id', id).single()).data!.title).toBe('Live day renamed')
    expect(await notesFor(going.id, 'org_event_id', id)).toEqual([])
    expect(await notesFor(follower.id, 'org_event_id', id)).toEqual([])

    const moved = await app.request(`/api/organizations/${orgId}/events/${id}`, send(leader.token, 'PATCH', { ...same, starts_at: at(20) }))
    expect(moved.status).toBe(200)
    expect(await notesFor(going.id, 'org_event_id', id)).toEqual([
      { type: 'org_event_changed', tutorial_title: 'Live day renamed', actor_name: expect.stringContaining('Edit journeys') },
    ])
  })

  it('an event another organisation leads cannot be edited', async () => {
    const id = await createEvent('draft')
    const res = await app.request(`/api/organizations/${orgId}/events/${id}`, send(follower.token, 'PATCH', eventBody({ title: 'Hijacked' })))
    expect(res.status).toBe(404)
    expect((await adminClient().from('org_events').select('title').eq('id', id).single()).data!.title).toBe('Edit day')
  })
})

describe('editing a story', () => {
  it('L36 Save as draft stores the edit and tells nobody; Publish to Stories tells each follower once; Save changes then tells no one', async () => {
    const id = await createStory('draft')
    const admin = adminClient()
    const body = (over: Record<string, unknown>) => ({
      kind: 'family', title: 'Edit story', summary: 's', body: 'b', byline: 'A leader', consent_confirmed: true, ...over,
    })
    const draft = await app.request(`/api/organizations/${orgId}/stories/${id}`, send(leader.token, 'PATCH', body({ title: 'Edited story', status: 'draft' })))
    expect(draft.status).toBe(200)
    expect((await admin.from('org_stories').select('title, status, published_at').eq('id', id).single()).data).toEqual({ title: 'Edited story', status: 'draft', published_at: null })
    expect(await notesFor(follower.id, 'org_story_id', id)).toEqual([])

    const publish = await app.request(`/api/organizations/${orgId}/stories/${id}`, send(leader.token, 'PATCH', body({ title: 'Edited story', status: 'published' })))
    expect(publish.status).toBe(200)
    const live = (await admin.from('org_stories').select('status, published_at').eq('id', id).single()).data!
    expect(live.status).toBe('published')
    expect(live.published_at).not.toBeNull()
    expect(await notesFor(follower.id, 'org_story_id', id)).toEqual([
      { type: 'org_story_published', tutorial_title: 'Edited story', actor_name: expect.stringContaining('Edit journeys') },
    ])

    const save = await app.request(`/api/organizations/${orgId}/stories/${id}`, send(leader.token, 'PATCH', body({ title: 'Edited again', status: 'published' })))
    expect(save.status).toBe(200)
    expect((await admin.from('org_stories').select('title, published_at').eq('id', id).single()).data).toEqual({ title: 'Edited again', published_at: live.published_at })
    expect(await notesFor(follower.id, 'org_story_id', id)).toHaveLength(1)
  })

  it('L36 publishing without consent is refused in words and leaves the story a draft', async () => {
    const id = await createStory('draft')
    await adminClient().from('org_stories').update({ consent_confirmed: false }).eq('id', id)
    const res = await app.request(`/api/organizations/${orgId}/stories/${id}`, send(leader.token, 'PATCH', {
      kind: 'family', title: 'Edit story', summary: 's', body: 'b', byline: 'A leader', consent_confirmed: false, status: 'published',
    }))
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toMatch(/consent/i)
    expect((await adminClient().from('org_stories').select('status').eq('id', id).single()).data!.status).toBe('draft')
  })
})
