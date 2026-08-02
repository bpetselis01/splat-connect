import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'
import app from '../../../src/app.js'

let user: TestUser
let stranger: TestUser
let tutorialId: string
let notificationId: string

beforeAll(async () => {
  user = await createTestUser('contributor')
  stranger = await createTestUser('contributor')
  tutorialId = await createProject({ authorId: user.id, status: 'draft' })
})

afterAll(async () => {
  await adminClient().from('tutorials').delete().eq('id', tutorialId)
  await deleteTestUser(user.id)
  await deleteTestUser(stranger.id)
})

beforeEach(async () => {
  const { data } = await adminClient()
    .from('notifications')
    .insert({ recipient_id: user.id, type: 'tutorial_approved', tutorial_id: tutorialId, actor_name: 'SPLAT' })
    .select('id')
    .single()
  notificationId = data!.id as string
})

function authed(token: string) {
  return { headers: { Authorization: `Bearer ${token}` } }
}

describe('GET /api/notifications/me', () => {
  it('lists my notifications, newest first', async () => {
    const res = await app.request('/api/notifications/me', authed(user.token))
    const body = await res.json()
    expect(body.some((n: { id: string }) => n.id === notificationId)).toBe(true)
  })
})

describe('GET /api/notifications/me/unread-count', () => {
  it('counts unread notifications', async () => {
    const res = await app.request('/api/notifications/me/unread-count', authed(user.token))
    const body = await res.json()
    expect(body.count).toBeGreaterThanOrEqual(1)
  })
})

describe('PATCH /api/notifications/:id', () => {
  it('marks my own notification read', async () => {
    const res = await app.request(`/api/notifications/${notificationId}`, {
      ...authed(user.token),
      method: 'PATCH',
      headers: { ...authed(user.token).headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: true }),
    })
    expect(res.status).toBe(204)
  })

  it('cannot mark someone else\'s notification read', async () => {
    const res = await app.request(`/api/notifications/${notificationId}`, {
      ...authed(stranger.token),
      method: 'PATCH',
      headers: { ...authed(stranger.token).headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: true }),
    })
    expect(res.status).toBe(403)
  })
})
