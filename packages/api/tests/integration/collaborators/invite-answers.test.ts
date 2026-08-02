import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'
import { createInvite } from '../../helpers/collaborators.js'
import app from '../../../src/app.js'

let primary: TestUser
let invitee: TestUser
let tutorialId: string
let inviteId: string

beforeAll(async () => {
  primary = await createTestUser('contributor')
  invitee = await createTestUser('contributor')
})

afterAll(async () => {
  await deleteTestUser(primary.id)
  await deleteTestUser(invitee.id)
})

beforeEach(async () => {
  tutorialId = await createProject({ authorId: primary.id, status: 'draft' })
  inviteId = await createInvite({ tutorialId, invitedProfileId: invitee.id, invitedBy: primary.id })
})

function authed(token: string) {
  return { headers: { Authorization: `Bearer ${token}` } }
}

describe('GET /api/collaborators/me/invites', () => {
  it('lists my pending invites', async () => {
    const res = await app.request('/api/collaborators/me/invites', authed(invitee.token))
    const body = await res.json()
    expect(body.some((i: { id: string }) => i.id === inviteId)).toBe(true)
  })
})

describe('POST /api/collaborators/invites/:id/accept', () => {
  it('accepts and claims the seat, notifying the primary', async () => {
    const res = await app.request(`/api/collaborators/invites/${inviteId}/accept`, { ...authed(invitee.token), method: 'POST' })
    expect(res.status).toBe(200)

    const seat = await adminClient().from('tutorial_contributors').select('role').eq('tutorial_id', tutorialId).eq('profile_id', invitee.id).single()
    expect(seat.data?.role).toBe('collaborator')

    const notif = await adminClient().from('notifications').select('type').eq('recipient_id', primary.id).eq('tutorial_id', tutorialId)
    expect(notif.data?.[0]?.type).toBe('collaborator_accepted')
  })
})

describe('POST /api/collaborators/invites/:id/decline', () => {
  it('declines without creating a seat, notifying the primary', async () => {
    const res = await app.request(`/api/collaborators/invites/${inviteId}/decline`, { ...authed(invitee.token), method: 'POST' })
    expect(res.status).toBe(200)

    const seat = await adminClient().from('tutorial_contributors').select('role').eq('tutorial_id', tutorialId).eq('profile_id', invitee.id).maybeSingle()
    expect(seat.data).toBeNull()

    const notif = await adminClient().from('notifications').select('type').eq('recipient_id', primary.id).eq('tutorial_id', tutorialId)
    expect(notif.data?.[0]?.type).toBe('collaborator_declined')
  })
})
