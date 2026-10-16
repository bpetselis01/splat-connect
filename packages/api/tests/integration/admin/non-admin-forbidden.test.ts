/**
 * Every /api/admin route is for admins only. A signed-in ordinary member must be
 * refused on all of them, so a new admin route added without the role check
 * (or mounted outside the admin sub-app) fails here.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'

const ID = '00000000-0000-4000-8000-000000000000'
const concrete = (path: string) => path.replace(/:[A-Za-z_]+(\{[^}]*\})?/g, ID).replace(/\*/g, 'x')
const routes = app.routes.filter((r) => r.method !== 'ALL' && r.path.startsWith('/api/admin'))

let member: TestUser
beforeAll(async () => {
  member = await createTestUser('contributor')
})
afterAll(async () => {
  await deleteTestUser(member.id)
})

describe('an ordinary member is refused on every admin route', () => {
  it('finds the routes it is meant to police', () => {
    expect(routes.length).toBeGreaterThan(20)
  })

  it.each(routes.map((r) => [r.method, r.path]))('%s %s -> 403', async (method, path) => {
    const res = await app.request(concrete(path), {
      method,
      headers: { Authorization: `Bearer ${member.token}`, 'Content-Type': 'application/json' },
      ...(method === 'GET' || method === 'DELETE' ? {} : { body: '{}' }),
    })
    expect(res.status).toBe(403)
  })
})
