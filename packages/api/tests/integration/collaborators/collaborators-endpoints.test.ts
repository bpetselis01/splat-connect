import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'
import app from '../../../src/app.js'

let primary: TestUser
let invitee: TestUser
let stranger: TestUser
let tutorialId: string

beforeAll(async () => {
  primary = await createTestUser('contributor')
  invitee = await createTestUser('contributor')
  stranger = await createTestUser('contributor')
})

beforeEach(async () => {
  tutorialId = await createProject({ authorId: primary.id, status: 'draft' })
})

afterAll(async () => {
  await deleteTestUser(primary.id)
  await deleteTestUser(invitee.id)
  await deleteTestUser(stranger.id)
})

function authed(token: string, init: RequestInit = {}) {
  return { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
}

describe('POST /api/tutorials/:id/collaborators/invite', () => {
  it('T23 WT30 the primary contributor can invite by email, leaving a pending invite and telling the invitee (collaborator_invited)', async () => {
    const res = await app.request(
      `/api/tutorials/${tutorialId}/collaborators/invite`,
      authed(primary.token, { method: 'POST', body: JSON.stringify({ email: invitee.email }) })
    )
    expect(res.status).toBe(201)
    const notif = await adminClient().from('notifications').select('type, tutorial_title').eq('recipient_id', invitee.id).eq('tutorial_id', tutorialId)
    expect(notif.data?.[0]?.type).toBe('collaborator_invited')
    // The invitee isn't a contributor yet, so RLS blocks a live tutorials
    // join — the title has to be denormalized (016) to render at all.
    expect(notif.data?.[0]?.tutorial_title).toBe('Backing Fixture')
    const invites = await adminClient().from('tutorial_collaborator_invites').select('invited_profile_id, status').eq('tutorial_id', tutorialId)
    expect(invites.data).toEqual([{ invited_profile_id: invitee.id, status: 'pending' }])
  })

  it('a stranger cannot invite', async () => {
    const res = await app.request(
      `/api/tutorials/${tutorialId}/collaborators/invite`,
      authed(stranger.token, { method: 'POST', body: JSON.stringify({ email: invitee.email }) })
    )
    expect(res.status).toBe(403)
  })

  it('404s on an unknown email', async () => {
    const res = await app.request(
      `/api/tutorials/${tutorialId}/collaborators/invite`,
      authed(primary.token, { method: 'POST', body: JSON.stringify({ email: 'nobody@nowhere.test' }) })
    )
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/tutorials/:id/collaborators/:profileId', () => {
  beforeEach(async () => {
    await adminClient().from('tutorial_contributors').insert({ tutorial_id: tutorialId, profile_id: invitee.id, role: 'collaborator' })
  })

  it('T24 WT30 the primary can remove a collaborator, who loses the seat and gets notified (collaborator_removed)', async () => {
    const res = await app.request(`/api/tutorials/${tutorialId}/collaborators/${invitee.id}`, authed(primary.token, { method: 'DELETE' }))
    expect(res.status).toBe(204)
    const seat = await adminClient().from('tutorial_contributors').select('profile_id').eq('tutorial_id', tutorialId).eq('profile_id', invitee.id)
    expect(seat.data).toEqual([])
    const notif = await adminClient().from('notifications').select('type, tutorial_title').eq('recipient_id', invitee.id).eq('tutorial_id', tutorialId)
    expect(notif.data?.[0]?.type).toBe('collaborator_removed')
    // The removed collaborator loses tutorial_contributors visibility in the
    // same request — a live join would have returned null here.
    expect(notif.data?.[0]?.tutorial_title).toBe('Backing Fixture')
  })

  it('T24 WT30 a collaborator can remove themself, and the primary gets notified (collaborator_left)', async () => {
    const res = await app.request(`/api/tutorials/${tutorialId}/collaborators/${invitee.id}`, authed(invitee.token, { method: 'DELETE' }))
    expect(res.status).toBe(204)
    const seat = await adminClient().from('tutorial_contributors').select('profile_id').eq('tutorial_id', tutorialId).eq('profile_id', invitee.id)
    expect(seat.data).toEqual([])
    const notif = await adminClient().from('notifications').select('type, tutorial_title').eq('recipient_id', primary.id).eq('tutorial_id', tutorialId)
    expect(notif.data?.[0]?.type).toBe('collaborator_left')
    expect(notif.data?.[0]?.tutorial_title).toBe('Backing Fixture')
  })

  it('a collaborator cannot remove another collaborator', async () => {
    const other = await createTestUser('contributor')
    await adminClient().from('tutorial_contributors').insert({ tutorial_id: tutorialId, profile_id: other.id, role: 'collaborator' })
    const res = await app.request(`/api/tutorials/${tutorialId}/collaborators/${other.id}`, authed(invitee.token, { method: 'DELETE' }))
    expect(res.status).toBe(403)
    await deleteTestUser(other.id)
  })
})
