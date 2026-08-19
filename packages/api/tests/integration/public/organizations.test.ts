import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'
import { createOrg, cleanupOrg } from '../../helpers/orgs.js'

describe('GET /api/public/organizations', () => {
  let owner: TestUser
  const orgIds: string[] = []

  beforeAll(async () => {
    owner = await createTestUser()
  })

  afterAll(async () => {
    for (const id of orgIds) await cleanupOrg(id)
    await deleteTestUser(owner.id)
  })

  it('is reachable with no Authorization header', async () => {
    const res = await app.request('/api/public/organizations')
    expect(res.status).toBe(200)
    expect(Array.isArray(await res.json())).toBe(true)
  })

  it('returns an organisation with only its public fields', async () => {
    const orgId = await createOrg({ createdBy: owner.id, name: `Public Org ${Date.now()}` })
    orgIds.push(orgId)

    const res = await app.request('/api/public/organizations')
    const rows = (await res.json()) as Array<Record<string, unknown>>
    const found = rows.find((r) => r.id === orgId)

    expect(found).toBeDefined()
    expect(Object.keys(found!).sort()).toEqual(['description', 'id', 'name', 'status'])
  })

  // The field-drift hazard: org_leaders carries user ids.
  it('never exposes org_leaders', async () => {
    const res = await app.request('/api/public/organizations')
    const body = await res.text()
    expect(body).not.toContain('org_leaders')
  })

  // Suspended orgs stay listed and marked: one vanishing from a directory is
  // unexplainable to someone who expected to find it, and their name is still on
  // work they already backed.
  it('includes a suspended organisation so its badge stays explainable', async () => {
    const orgId = await createOrg({
      createdBy: owner.id,
      name: `Suspended Org ${Date.now()}`,
      status: 'suspended',
    })
    orgIds.push(orgId)

    const res = await app.request('/api/public/organizations')
    const rows = (await res.json()) as Array<{ id: string; status: string }>
    expect(rows.find((r) => r.id === orgId)?.status).toBe('suspended')
  })
})
