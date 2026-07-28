import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader, cleanupOrg } from '../../helpers/orgs.js'

let user: TestUser
let leader: TestUser
let activeOrg: string
let suspendedOrg: string

const authed = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
})

beforeAll(async () => {
  user = await createTestUser('contributor')
  leader = await createTestUser('contributor')
  activeOrg = await createOrg({ createdBy: user.id, name: 'Riverside Therapy' })
  await addLeader(activeOrg, leader.id)
  suspendedOrg = await createOrg({ createdBy: user.id, status: 'suspended' })
})

afterAll(async () => {
  await cleanupOrg(activeOrg)
  await cleanupOrg(suspendedOrg)
  await deleteTestUser(user.id)
  await deleteTestUser(leader.id)
})

describe('GET /api/organizations', () => {
  it('lists organisations including suspended ones', async () => {
    const res = await app.request('/api/organizations', authed(user.token))
    expect(res.status).toBe(200)
    const list = (await res.json()) as Array<{ id: string; status: string }>
    const ids = list.map((o) => o.id)
    expect(ids).toContain(activeOrg)
    // Suspended organisations stay visible: their badge must keep rendering on
    // work they already backed, and hiding them makes an absence unexplainable.
    expect(ids).toContain(suspendedOrg)
    expect(list.find((o) => o.id === suspendedOrg)?.status).toBe('suspended')
  })
})

describe('GET /api/organizations/:id', () => {
  it('returns one organisation with its leaders', async () => {
    const res = await app.request(`/api/organizations/${activeOrg}`, authed(user.token))
    expect(res.status).toBe(200)
    const org = (await res.json()) as { name: string; org_leaders: Array<{ user_id: string }> }
    expect(org.name).toBe('Riverside Therapy')
    expect(org.org_leaders.map((l) => l.user_id)).toEqual([leader.id])
  })

  it('returns only the orgs the caller leads from /mine', async () => {
    const mine = await app.request('/api/organizations/mine', authed(leader.token))
    expect(((await mine.json()) as Array<{ id: string }>).map((o) => o.id)).toEqual([activeOrg])

    const none = await app.request('/api/organizations/mine', authed(user.token))
    expect((await none.json()) as unknown[]).toHaveLength(0)
  })

  it('404s for an organisation that does not exist', async () => {
    const res = await app.request(`/api/organizations/${crypto.randomUUID()}`, authed(user.token))
    expect(res.status).toBe(404)
  })
})
