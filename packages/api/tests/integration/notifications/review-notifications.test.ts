import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'
import app from '../../../src/app.js'

let admin: TestUser
let author: TestUser
let collaborator: TestUser
let tutorialId: string

beforeAll(async () => {
  admin = await createTestUser('admin')
  author = await createTestUser('contributor')
  collaborator = await createTestUser('contributor')
})

afterAll(async () => {
  await deleteTestUser(admin.id)
  await deleteTestUser(author.id)
  await deleteTestUser(collaborator.id)
})

beforeEach(async () => {
  tutorialId = await createProject({ authorId: author.id, status: 'pending' })
  await adminClient().from('tutorial_contributors').insert({ tutorial_id: tutorialId, profile_id: collaborator.id, role: 'collaborator' })
})

function authed(token: string) {
  return { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
}

describe('admin review notifies every contributor', () => {
  it('approving notifies both the primary and the collaborator', async () => {
    const res = await app.request(`/api/admin/tutorials/${tutorialId}/status`, {
      ...authed(admin.token),
      method: 'PATCH',
      body: JSON.stringify({ status: 'approved' }),
    })
    expect(res.status).toBe(200)

    const notifs = await adminClient().from('notifications').select('recipient_id, type').eq('tutorial_id', tutorialId)
    const recipients = (notifs.data ?? []).map((n) => n.recipient_id)
    expect(recipients).toEqual(expect.arrayContaining([author.id, collaborator.id]))
    expect(notifs.data?.every((n) => n.type === 'tutorial_approved')).toBe(true)
  })

  it('rejecting notifies every contributor', async () => {
    const res = await app.request(`/api/admin/tutorials/${tutorialId}/status`, {
      ...authed(admin.token),
      method: 'PATCH',
      body: JSON.stringify({ status: 'rejected', rejection_note: 'Needs more detail' }),
    })
    expect(res.status).toBe(200)

    const notifs = await adminClient().from('notifications').select('type').eq('tutorial_id', tutorialId)
    expect(notifs.data?.every((n) => n.type === 'tutorial_rejected')).toBe(true)
  })
})
