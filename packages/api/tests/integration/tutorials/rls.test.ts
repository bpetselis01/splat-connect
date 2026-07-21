import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let owner: TestUser
let other: TestUser
const tutorialId = crypto.randomUUID()

const authed = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(init.headers ?? {}),
  },
})

beforeAll(async () => {
  owner = await createTestUser('contributor')
  other = await createTestUser('contributor')

  const create = await app.request(
    '/api/tutorials',
    authed(owner.token, {
      method: 'POST',
      body: JSON.stringify({ id: tutorialId, title: 'Private Draft', difficulty: 'easy' }),
    })
  )
  expect(create.status).toBe(201)

  const link = await app.request(
    `/api/contributors/me/tutorials/${tutorialId}`,
    authed(owner.token, { method: 'POST' })
  )
  expect(link.status).toBe(201)
})

afterAll(async () => {
  // tutorials have no FK to profiles — delete explicitly before the users
  await adminClient().from('tutorials').delete().eq('id', tutorialId)
  await deleteTestUser(owner.id)
  await deleteTestUser(other.id)
})

describe('tutorial draft RLS', () => {
  it('owner can read their own draft', async () => {
    const res = await app.request(`/api/tutorials/${tutorialId}`, authed(owner.token))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(tutorialId)
    expect(body.status).toBe('draft')
  })

  it("another contributor cannot read someone else's draft", async () => {
    const res = await app.request(`/api/tutorials/${tutorialId}`, authed(other.token))
    expect(res.status).toBe(404)
  })

  it("another contributor's tutorial list does not leak the draft", async () => {
    const res = await app.request('/api/tutorials', authed(other.token))
    expect(res.status).toBe(200)
    const list = await res.json()
    expect(list.map((t: { id: string }) => t.id)).not.toContain(tutorialId)
  })
})
