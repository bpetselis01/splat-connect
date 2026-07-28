import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let user: TestUser
let other: TestUser

const authed = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
})

beforeAll(async () => {
  user = await createTestUser('contributor')
  other = await createTestUser('contributor')
})

afterAll(async () => {
  await adminClient().from('user_agreements').delete().eq('user_id', user.id)
  await deleteTestUser(user.id)
  await deleteTestUser(other.id)
})

describe('POST /api/agreements', () => {
  it('records an acceptance at the server-chosen version', async () => {
    const res = await app.request('/api/agreements', authed(user.token, {
      method: 'POST',
      body: JSON.stringify({ agreement_type: 'contributor_terms', version: 'v99-forged' }),
    }))
    expect(res.status).toBe(201)
    const row = (await res.json()) as { user_id: string; version: string }
    // The forged version in the body is ignored — the server picks it, so a
    // client cannot claim acceptance of terms that were never published.
    expect(row.version).toBe('v0-todo')
    expect(row.user_id).toBe(user.id)
  })

  it('refuses an unknown agreement type', async () => {
    const res = await app.request('/api/agreements', authed(user.token, {
      method: 'POST',
      body: JSON.stringify({ agreement_type: 'something_else' }),
    }))
    expect(res.status).toBe(400)
  })
})

describe('GET /api/agreements/me', () => {
  it("returns only the caller's acceptances", async () => {
    const mine = await app.request('/api/agreements/me', authed(user.token))
    expect(((await mine.json()) as unknown[]).length).toBe(1)

    const theirs = await app.request('/api/agreements/me', authed(other.token))
    expect(((await theirs.json()) as unknown[]).length).toBe(0)
  })
})
