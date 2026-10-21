/**
 * A draft event or story needs only a title (144); every other rule applies at publish.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'
import { addLeader, cleanupOrg, createOrg, setOrgPickup } from '../../helpers/orgs.js'

let leader: TestUser
let orgId: string

const call = (path: string, method: string, body?: unknown) =>
  app.request(`/api/organizations/${orgId}${path}`, {
    method,
    headers: { Authorization: `Bearer ${leader.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

beforeAll(async () => {
  leader = await createTestUser('contributor')
  orgId = await createOrg({ createdBy: leader.id, name: 'Draft Org' })
  await addLeader(orgId, leader.id)
  await setOrgPickup(orgId)
})

afterAll(async () => {
  await cleanupOrg(orgId)
  await deleteTestUser(leader.id)
})

describe('draft events', () => {
  it('WB19 saves a draft with only a title', async () => {
    const res = await call('/events', 'POST', { title: 'Just a title', status: 'draft' })
    expect(res.status).toBe(201)
    const row = await res.json()
    expect(row).toMatchObject({ title: 'Just a title', status: 'draft', starts_at: null })
  })

  it('WB19 refuses to publish an event with no date, in a sentence', async () => {
    const res = await call('/events', 'POST', { title: 'No date', status: 'published', format: 'online', online_url: 'https://x.test' })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Say when it starts.' })
  })

  it('WB19 refuses to publish an incomplete draft by status alone, in a sentence', async () => {
    const draft = (await (await call('/events', 'POST', { title: 'Incomplete', status: 'draft' })).json()) as { id: string }
    const res = await call(`/events/${draft.id}`, 'PATCH', { status: 'published' })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Finish the event before publishing it: it needs a date and a place.' })
  })

  it('WB19 a full edit that publishes still needs the place', async () => {
    const draft = (await (await call('/events', 'POST', { title: 'Edit me', status: 'draft' })).json()) as { id: string }
    const res = await call(`/events/${draft.id}`, 'PATCH', { title: 'Edit me', status: 'published', format: 'in_person' })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Say where it is.' })
  })

  it('WB19 a full edit of a draft keeps it a draft with only a title', async () => {
    const draft = (await (await call('/events', 'POST', { title: 'Edit me too', status: 'draft' })).json()) as { id: string }
    const res = await call(`/events/${draft.id}`, 'PATCH', { title: 'Renamed', status: 'draft' })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ title: 'Renamed', status: 'draft', starts_at: null })
  })
})

describe('draft stories', () => {
  it('WB25 saves a draft with only a title', async () => {
    const res = await call('/stories', 'POST', { title: 'Half a story', status: 'draft' })
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ title: 'Half a story', status: 'draft', summary: '', body: '', byline: '' })
  })

  it('WB25 refuses to publish a story missing its summary, body or byline, in a sentence', async () => {
    const res = await call('/stories', 'POST', { title: 'Thin', status: 'published', consent_confirmed: true })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'A story needs a title, a one-sentence summary, a body and a byline.' })
  })

  it('WB25 refuses to publish an incomplete draft by status alone, with the story sentence', async () => {
    const draft = (await (await call('/stories', 'POST', { title: 'Incomplete', status: 'draft' })).json()) as { id: string }
    const res = await call(`/stories/${draft.id}`, 'PATCH', { status: 'published', consent_confirmed: true })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'A story needs a title, a one-sentence summary, a body and a byline.' })
  })
})
