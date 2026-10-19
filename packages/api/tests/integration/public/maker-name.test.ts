// journeys: (none — route coverage; no journey row names this route yet)
/** GET /api/public/makers/:id gives a maker's name to anyone, unless they opted out; an unknown or opted-out id is the same 404. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let maker: TestUser
let hidden: TestUser

beforeAll(async () => {
  maker = await createTestUser('contributor')
  hidden = await createTestUser('contributor')
  const admin = adminClient()
  await admin.from('profiles').update({ name: 'Mabel Maker', public_showcase: true }).eq('id', maker.id)
  await admin.from('profiles').update({ name: 'Quiet Quinn', public_showcase: false }).eq('id', hidden.id)
})
afterAll(async () => {
  for (const u of [maker, hidden]) await deleteTestUser(u.id)
})

describe('public maker name', () => {
  it('returns only the id and name, without signing in', async () => {
    const res = await app.request(`/api/public/makers/${maker.id}`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: maker.id, name: 'Mabel Maker' })
  })

  it('answers an opted-out maker, an unknown id and a malformed id with the same 404', async () => {
    for (const id of [hidden.id, crypto.randomUUID(), 'not-a-uuid']) {
      const res = await app.request(`/api/public/makers/${id}`)
      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'Not found' })
    }
  })
})
