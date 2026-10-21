// journeys: (none — route coverage; PostgREST 1000-row cap, no journey row)
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { adminClient, createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'

let member: TestUser

beforeAll(async () => {
  member = await createTestUser('contributor')
  const rows = Array.from({ length: 1001 }, () => ({ recipient_id: member.id, type: 'toy_request', actor_name: 'Cap' }))
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await adminClient().from('notifications').insert(rows.slice(i, i + 500))
    if (error) throw new Error(`seed failed: ${error.message}`)
  }
})
afterAll(async () => {
  await adminClient().from('notifications').delete().eq('recipient_id', member.id)
  await deleteTestUser(member.id)
})

describe('GET /api/notifications/me/unread-counts', () => {
  it('counts every unread notification past the 1000-row cap', async () => {
    const res = await app.request('/api/notifications/me/unread-counts', { headers: { Authorization: `Bearer ${member.token}` } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ tutorials: 0, exchanges: 1001, challenges: 0, organisations: 0, total: 1001 })
  })
})
