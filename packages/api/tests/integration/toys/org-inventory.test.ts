/**
 * Who may touch an organisation's stock.
 *
 * Authority here derives from `is_org_leader(owner_org_id)` evaluated live, so
 * the interesting cases are the revocations: an ex-leader and a leader of some
 * other organisation must both be told the same thing a stranger is.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader, createOrgToy, setOrgPickup, cleanupOrg } from '../../helpers/orgs.js'

const BASE = 'http://localhost'
function req(path: string, token: string, init: RequestInit = {}) {
  return app.request(`${BASE}/api${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
}

describe("an organisation's toy inventory", () => {
  let leader: TestUser
  let exLeader: TestUser
  let rivalLeader: TestUser
  let stranger: TestUser
  let orgId: string
  let rivalOrgId: string

  beforeAll(async () => {
    leader = await createTestUser('contributor')
    exLeader = await createTestUser('contributor')
    rivalLeader = await createTestUser('contributor')
    stranger = await createTestUser('contributor')

    orgId = await createOrg({ createdBy: leader.id, name: 'Inventory Org' })
    rivalOrgId = await createOrg({ createdBy: rivalLeader.id, name: 'Rival Org' })
    await addLeader(orgId, leader.id)
    await addLeader(orgId, exLeader.id)
    await addLeader(rivalOrgId, rivalLeader.id)
  })

  afterAll(async () => {
    await cleanupOrg(orgId)
    await cleanupOrg(rivalOrgId)
    for (const u of [leader, exLeader, rivalLeader, stranger]) await deleteTestUser(u.id)
  })

  it('creates stock in one write, and keeps it out of the leader’s own toys', async () => {
    const res = await req('/toys', leader.token, {
      method: 'POST',
      body: JSON.stringify({ name: 'Sensory bear', condition: 9, owner_org_id: orgId, quantity: 5 }),
    })
    expect(res.status).toBe(200)
    const toy = (await res.json()) as any
    expect(toy.quantity).toBe(5)
    expect(toy.owner_org_id).toBe(orgId)
    expect(toy.owner_id).toBeNull()

    // My Toys means the toys this person holds. An org's shelf is not that,
    // or a leader cannot tell what is theirs to give away personally.
    const mine = (await (await req('/toys', leader.token)).json()) as any[]
    expect(mine.find((t) => t.id === toy.id)).toBeUndefined()

    const inventory = (await (await req('/toys/inventory', leader.token)).json()) as any[]
    expect(inventory.find((t) => t.id === toy.id)).toBeTruthy()
  })

  it('refuses to create stock for an organisation the caller does not lead', async () => {
    const res = await req('/toys', rivalLeader.token, {
      method: 'POST',
      body: JSON.stringify({ name: 'Not yours', condition: 5, owner_org_id: orgId, quantity: 3 }),
    })
    expect(res.status).toBe(403)
  })

  it('tops up existing stock rather than making a second row', async () => {
    const toyId = await createOrgToy({ orgId, quantity: 2 })
    const res = await req(`/toys/${toyId}`, leader.token, {
      method: 'PATCH',
      body: JSON.stringify({ quantity: 12 }),
    })
    expect(res.status).toBe(200)
    expect(((await res.json()) as any).quantity).toBe(12)
  })

  it('rejects a quantity that is not a whole number of toys', async () => {
    const toyId = await createOrgToy({ orgId, quantity: 2 })
    for (const quantity of [0, -1, 2.5]) {
      const res = await req(`/toys/${toyId}`, leader.token, {
        method: 'PATCH',
        body: JSON.stringify({ quantity }),
      })
      expect(res.status).toBe(400)
    }
  })

  it('will not let a person hold more than one of anything', async () => {
    const create = await req('/toys', stranger.token, {
      method: 'POST',
      body: JSON.stringify({ name: 'My own toy', condition: 6, quantity: 9 }),
    })
    // quantity is not an editable field on a personal toy, so the request
    // succeeds and the value is simply not honoured — the constraint in 033 is
    // the backstop behind that, not the error path.
    expect(create.status).toBe(200)
    expect(((await create.json()) as any).quantity).toBe(1)
  })

  it('shuts an ex-leader out the moment their leadership is removed', async () => {
    const toyId = await createOrgToy({ orgId, quantity: 4 })

    const before = await req(`/toys/${toyId}`, exLeader.token, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Renamed while a leader' }),
    })
    expect(before.status).toBe(200)

    await adminClient().from('org_leaders').delete().eq('org_id', orgId).eq('user_id', exLeader.id)

    // No cleanup job ran and no cache expired: the policy simply asks again.
    const after = await req(`/toys/${toyId}`, exLeader.token, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Renamed after removal' }),
    })
    expect(after.status).toBe(404)

    const inventory = (await (await req('/toys/inventory', exLeader.token)).json()) as any[]
    expect(inventory).toHaveLength(0)
  })

  it("gives a leader of another organisation the same 404 a stranger gets", async () => {
    const toyId = await createOrgToy({ orgId, quantity: 1 })
    for (const user of [rivalLeader, stranger]) {
      const patch = await req(`/toys/${toyId}`, user.token, {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Mine now' }),
      })
      // 404, never 403: a 403 would confirm the row exists.
      expect(patch.status).toBe(404)

      const del = await req(`/toys/${toyId}`, user.token, { method: 'DELETE' })
      expect(del.status).toBe(404)
    }
  })

  it('lets a leader publish org stock, which needs a photo they had to be able to upload', async () => {
    const create = await req('/toys', leader.token, {
      method: 'POST',
      body: JSON.stringify({ name: 'Publishable bear', condition: 8, owner_org_id: orgId, quantity: 2 }),
    })
    const toy = (await create.json()) as any

    const blocked = await req(`/toys/${toy.id}/publish`, leader.token, { method: 'PATCH' })
    expect(blocked.status).toBe(400)
    expect(((await blocked.json()) as any).missing).toContain('Cover photo')

    await req(`/toys/${toy.id}`, leader.token, {
      method: 'PATCH',
      body: JSON.stringify({ cover_photo_url: 'https://example.com/bear.jpg', offer_type: 'both' }),
    })
    const published = await req(`/toys/${toy.id}/publish`, leader.token, { method: 'PATCH' })
    expect(published.status).toBe(200)
    expect(((await published.json()) as any).status).toBe('published')
  })

  it('keeps the pickup address readable by leaders and by nobody else', async () => {
    await setOrgPickup(orgId)

    const mine = await req(`/organizations/${orgId}/pickup`, leader.token)
    expect(mine.status).toBe(200)
    expect(((await mine.json()) as any).pickup_line1).toBe('5 Association Way')

    // The instructions are where a leader writes "side gate, code 4417", which
    // is why 033 took the pickup columns off the public grant entirely.
    for (const user of [rivalLeader, stranger]) {
      const res = await req(`/organizations/${orgId}/pickup`, user.token)
      expect(res.status).toBe(404)
    }

    const bare = (await (await req(`/organizations/${orgId}`, stranger.token)).json()) as any
    expect(bare.name).toBeTruthy()
    expect(bare.pickup_line1).toBeUndefined()
    expect(bare.pickup_instructions).toBeUndefined()
  })

  it('lets a leader set the pickup address, and refuses a half-filled one', async () => {
    const partial = await req(`/organizations/${orgId}/pickup`, leader.token, {
      method: 'PATCH',
      body: JSON.stringify({ pickup_line1: '1 Somewhere', pickup_suburb: 'Town' }),
    })
    expect(partial.status).toBe(400)

    const full = await req(`/organizations/${orgId}/pickup`, leader.token, {
      method: 'PATCH',
      body: JSON.stringify({
        pickup_line1: '2 New Road',
        pickup_suburb: 'Newtown',
        pickup_state: 'NSW',
        pickup_postcode: '2042',
        pickup_instructions: 'Side gate',
      }),
    })
    expect(full.status).toBe(200)
    expect(((await full.json()) as any).pickup_line1).toBe('2 New Road')

    const notMine = await req(`/organizations/${rivalOrgId}/pickup`, leader.token, {
      method: 'PATCH',
      body: JSON.stringify({
        pickup_line1: 'x',
        pickup_suburb: 'x',
        pickup_state: 'x',
        pickup_postcode: 'x',
      }),
    })
    expect(notMine.status).toBe(404)
  })
})
