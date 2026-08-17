/**
 * What a browsing parent sees of an organisation's shelf.
 *
 * The rule this pins used to be "hide any toy with an accepted handoff", which
 * was the same rule only while one row meant one object. Left alone, the first
 * family to request a bear would empty the card for the other four.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader, createOrgToy, setOrgPickup, cleanupOrg } from '../../helpers/orgs.js'

const BASE = 'http://localhost'
function txReq(path: string, token: string, init: RequestInit = {}) {
  const url = path === '/' ? `${BASE}/api/toy-transactions` : `${BASE}/api/toy-transactions${path}`
  return app.request(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
}

async function publicIds(): Promise<string[]> {
  const res = await app.request('/api/public/toys')
  return ((await res.json()) as Array<{ id: string }>).map((r) => r.id)
}

describe('org stock in the public library', () => {
  let leader: TestUser
  let family: TestUser
  let orgId: string
  let toyId: string

  beforeAll(async () => {
    leader = await createTestUser('contributor')
    family = await createTestUser('contributor')
    orgId = await createOrg({ createdBy: leader.id, name: 'Library Org' })
    await addLeader(orgId, leader.id)
    await setOrgPickup(orgId)
    toyId = await createOrgToy({ orgId, quantity: 2, name: 'Library Bear' })
  })

  afterAll(async () => {
    await adminClient().from('toys').delete().eq('owner_id', family.id)
    await cleanupOrg(orgId)
    await deleteTestUser(leader.id)
    await deleteTestUser(family.id)
  })

  it('names the organisation as the holder rather than a person', async () => {
    const res = await app.request(`/api/public/toys/${toyId}`)
    expect(res.status).toBe(200)
    const toy = (await res.json()) as any
    expect(toy.organizations?.name).toBe('Library Org')
    expect(toy.profiles).toBeNull()
    expect(toy.quantity).toBe(2)
  })

  it('stays listed while one of two bears is mid-handoff', async () => {
    const create = await txReq('/', family.token, {
      method: 'POST',
      body: JSON.stringify({ toy_id: toyId, type: 'donation' }),
    })
    const tx = (await create.json()) as { id: string }
    const accept = await txReq(`/${tx.id}/accept`, leader.token, { method: 'POST', body: '{}' })
    expect(accept.status).toBe(200)

    // One promised, one still on the shelf.
    expect(await publicIds()).toContain(toyId)
    expect((await app.request(`/api/public/toys/${toyId}`)).status).toBe(200)

    // Completing it takes stock to 1, with nothing accepted: still listed.
    const familyView = (await (await txReq(`/${tx.id}`, family.token)).json()) as any
    await txReq(`/${tx.id}/confirm`, leader.token, {
      method: 'POST',
      body: JSON.stringify({ code: familyView.requester_code }),
    })
    expect(await publicIds()).toContain(toyId)
  })

  it('disappears once the stock is gone, without the row being deleted', async () => {
    // Take the last unit the short way: this test is about the library, not
    // about the handoff, which the org-handoff suite already pins.
    await adminClient().from('toys').update({ quantity: 0 }).eq('id', toyId)

    expect(await publicIds()).not.toContain(toyId)
    expect((await app.request(`/api/public/toys/${toyId}`)).status).toBe(404)

    // The catalogue entry survives, ready to be topped up when more arrive —
    // which is the point of counting stock rather than archiving at zero.
    const { data } = await adminClient().from('toys').select('id, status').eq('id', toyId).single()
    expect(data!.status).toBe('published')

    await adminClient().from('toys').update({ quantity: 4 }).eq('id', toyId)
    expect(await publicIds()).toContain(toyId)
  })
})
