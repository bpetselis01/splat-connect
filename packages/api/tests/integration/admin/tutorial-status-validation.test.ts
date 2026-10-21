/** PATCH /admin/tutorials/:id/status accepts only the two verdicts the web sends. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'

let admin: TestUser
let author: TestUser
let id: string

const patch = (body: unknown) =>
  app.request(`/api/admin/tutorials/${id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${admin.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

beforeAll(async () => {
  ;[admin, author] = await Promise.all([createTestUser('admin'), createTestUser('contributor')])
  id = await createProject({ authorId: author.id, status: 'pending' })
})

afterAll(async () => {
  await adminClient().from('tutorials').delete().eq('id', id)
  await Promise.all([deleteTestUser(admin.id), deleteTestUser(author.id)])
})

describe('admin guide status validation', () => {
  it.each(['draft', 'pending', 'bogus', ''])('answers 400 for status %j and leaves the guide pending', async (status) => {
    const res = await patch({ status })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "status must be 'approved' or 'rejected'" })
    expect((await adminClient().from('tutorials').select('status').eq('id', id).single()).data).toEqual({ status: 'pending' })
  })

  it('answers 400 when the status is missing', async () => {
    expect((await patch({})).status).toBe(400)
  })

  it('approves with a valid status', async () => {
    const res = await patch({ status: 'approved' })
    expect(res.status).toBe(200)
    expect((await adminClient().from('tutorials').select('status').eq('id', id).single()).data).toEqual({ status: 'approved' })
  })
})
