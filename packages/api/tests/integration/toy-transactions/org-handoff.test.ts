/**
 * An organisation giving from stock.
 *
 * Everything here is the difference between "one row is one object" and "one
 * row is five bears". The peer-to-peer suites next door still pin the
 * quantity=1 case, which must not have moved.
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
function toysReq(path: string, token: string, init: RequestInit = {}) {
  const url = path === '/' ? `${BASE}/api/toys` : `${BASE}/api/toys${path}`
  return app.request(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
}

const REQUESTER_ADDRESS = {
  pickup_line1: '99 Somewhere Else',
  pickup_suburb: 'Nowhere',
  pickup_state: 'QLD',
  pickup_postcode: '4000',
}

async function requestToy(token: string, toyId: string, type = 'donation', offeredToyId?: string) {
  const res = await txReq('/', token, {
    method: 'POST',
    body: JSON.stringify({ toy_id: toyId, type, ...(offeredToyId ? { offered_toy_id: offeredToyId } : {}) }),
  })
  return { status: res.status, body: (await res.json()) as any }
}

describe('an organisation giving from stock', () => {
  let leader: TestUser
  let otherLeader: TestUser
  let families: TestUser[]
  let orgId: string

  beforeAll(async () => {
    leader = await createTestUser('contributor')
    otherLeader = await createTestUser('contributor')
    families = []
    for (let i = 0; i < 6; i++) families.push(await createTestUser('contributor'))

    orgId = await createOrg({ createdBy: leader.id, name: 'Cerebral Palsy Alliance Test' })
    await addLeader(orgId, leader.id)
    await addLeader(orgId, otherLeader.id)
    await setOrgPickup(orgId)
  })

  afterAll(async () => {
    await cleanupOrg(orgId)
    await deleteTestUser(leader.id)
    await deleteTestUser(otherLeader.id)
    for (const f of families) await deleteTestUser(f.id)
  })

  it('lets five families be mid-handoff on five bears, and refuses a sixth', async () => {
    const toyId = await createOrgToy({ orgId, quantity: 5 })

    const accepted: string[] = []
    for (let i = 0; i < 5; i++) {
      const { status, body } = await requestToy(families[i].token, toyId)
      expect(status).toBe(201)
      const res = await txReq(`/${body.id}/accept`, leader.token, { method: 'POST', body: '{}' })
      expect(res.status).toBe(200)
      accepted.push(body.id)
    }

    // Every unit spoken for. A new request is refused with the same bare 404 an
    // inaccessible toy gets — a prober cannot tell "out of stock" from "no such
    // toy".
    const sixth = await requestToy(families[5].token, toyId)
    expect(sixth.status).toBe(404)

    expect(accepted).toHaveLength(5)
  })

  it('takes exactly one unit when two leaders accept the same last bear at once', async () => {
    const toyId = await createOrgToy({ orgId, quantity: 1 })
    const a = await requestToy(families[0].token, toyId)
    const b = await requestToy(families[1].token, toyId)
    expect(a.status).toBe(201)
    expect(b.status).toBe(201)

    // The oversell. Both leaders read "0 of 1 taken" and both would pass a
    // read-then-write check; accept_toy_transaction()'s row lock is what makes
    // exactly one of these win.
    const [first, second] = await Promise.all([
      txReq(`/${a.body.id}/accept`, leader.token, { method: 'POST', body: '{}' }),
      txReq(`/${b.body.id}/accept`, otherLeader.token, { method: 'POST', body: '{}' }),
    ])

    const statuses = [first.status, second.status].sort()
    expect(statuses).toEqual([200, 409])

    const { count } = await adminClient()
      .from('toy_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('toy_id', toyId)
      .eq('status', 'accepted')
    expect(count).toBe(1)
  })

  it("uses the organisation's fixed address and ignores one sent by a leader", async () => {
    const toyId = await createOrgToy({ orgId, quantity: 1 })
    const { body: tx } = await requestToy(families[2].token, toyId)

    const res = await txReq(`/${tx.id}/accept`, leader.token, {
      method: 'POST',
      body: JSON.stringify(REQUESTER_ADDRESS),
    })
    expect(res.status).toBe(200)

    const accepted = (await res.json()) as any
    expect(accepted.pickup_line1).toBe('5 Association Way')
    expect(accepted.pickup_postcode).toBe('2063')
    expect(accepted.pickup_instructions).toMatch(/reception/i)
    // The leader's attempt to vary it did not land anywhere.
    expect(accepted.pickup_line1).not.toBe(REQUESTER_ADDRESS.pickup_line1)
  })

  it('refuses to accept for an organisation that has set no address, and says why', async () => {
    const bareOrgId = await createOrg({ createdBy: leader.id, name: 'No Address Org' })
    await addLeader(bareOrgId, leader.id)
    const toyId = await createOrgToy({ orgId: bareOrgId, quantity: 2 })
    const { body: tx } = await requestToy(families[3].token, toyId)

    const res = await txReq(`/${tx.id}/accept`, leader.token, { method: 'POST', body: '{}' })
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toMatch(/pickup address/i)

    await cleanupOrg(bareOrgId)
  })

  it('gives a leader the owner-side code, not the requester’s', async () => {
    const toyId = await createOrgToy({ orgId, quantity: 1 })
    const { body: tx } = await requestToy(families[4].token, toyId)
    await txReq(`/${tx.id}/accept`, leader.token, { method: 'POST', body: '{}' })

    // The failure this pins is silent: the wrong code here means two people in
    // a room reciting a number that does not match, with nothing on screen
    // suggesting the platform is at fault.
    const leaderView = (await (await txReq(`/${tx.id}`, leader.token)).json()) as any
    expect(leaderView.owner_code).toMatch(/^\d{6}$/)
    expect(leaderView.requester_code).toBeNull()

    const familyView = (await (await txReq(`/${tx.id}`, families[4].token)).json()) as any
    expect(familyView.requester_code).toMatch(/^\d{6}$/)
    expect(familyView.owner_code).toBeNull()

    // And the two are genuinely different codes, or the check is self-servable.
    expect(leaderView.owner_code).not.toBe(familyView.requester_code)
  })

  it('decrements stock and mints a single-unit toy for the family on confirm', async () => {
    const toyId = await createOrgToy({ orgId, quantity: 3 })
    const family = families[0]
    const { body: tx } = await requestToy(family.token, toyId)
    await txReq(`/${tx.id}/accept`, leader.token, { method: 'POST', body: '{}' })

    // The leader types the code the family is holding, which is exactly why
    // their own view does not carry it.
    const familyView = (await (await txReq(`/${tx.id}`, family.token)).json()) as any
    const confirm = await txReq(`/${tx.id}/confirm`, leader.token, {
      method: 'POST',
      body: JSON.stringify({ code: familyView.requester_code }),
    })
    expect(confirm.status).toBe(200)

    const { data: stock } = await adminClient().from('toys').select('quantity').eq('id', toyId).single()
    expect(stock!.quantity).toBe(2)

    // The org's row did NOT change hands — it is still the shelf.
    const { data: source } = await adminClient()
      .from('toys')
      .select('owner_id, owner_org_id')
      .eq('id', toyId)
      .single()
    expect(source!.owner_org_id).toBe(orgId)
    expect(source!.owner_id).toBeNull()

    // A new row exists for the family: theirs, one unit, unlisted.
    const { data: minted } = await adminClient()
      .from('toys')
      .select('id, quantity, status, owner_org_id')
      .eq('owner_id', family.id)
    expect(minted).toHaveLength(1)
    expect(minted![0].quantity).toBe(1)
    expect(minted![0].status).toBe('draft')
    expect(minted![0].owner_org_id).toBeNull()

    await adminClient().from('toys').delete().eq('owner_id', family.id)
  })

  it('leaves rival requests open until the stock actually runs out', async () => {
    const toyId = await createOrgToy({ orgId, quantity: 2 })
    const [one, two, three] = await Promise.all([
      requestToy(families[1].token, toyId),
      requestToy(families[2].token, toyId),
      requestToy(families[3].token, toyId),
    ])

    await txReq(`/${one.body.id}/accept`, leader.token, { method: 'POST', body: '{}' })
    await completeAsLeader(one.body.id, leader.token)

    // One bear gone, one left: the other two families are still in the running.
    for (const other of [two, three]) {
      const view = (await (await txReq(`/${other.body.id}`, leader.token)).json()) as any
      expect(view.status).toBe('requested')
    }

    await txReq(`/${two.body.id}/accept`, leader.token, { method: 'POST', body: '{}' })
    await completeAsLeader(two.body.id, leader.token)

    // Out of stock. Only now is the last one declined, and the copy says why.
    const declined = (await (await txReq(`/${three.body.id}`, leader.token)).json()) as any
    expect(declined.status).toBe('rejected')
    expect(
      declined.messages.some((m: { body: string }) => /out of stock/i.test(m.body))
    ).toBe(true)

    for (const f of [families[1], families[2]]) {
      await adminClient().from('toys').delete().eq('owner_id', f.id)
    }
  })

  it('takes an exchanged toy into the organisation as an unlisted draft', async () => {
    const toyId = await createOrgToy({ orgId, quantity: 2, offerType: 'exchange' })
    const family = families[5]

    const create = await toysReq('/', family.token, {
      method: 'POST',
      body: JSON.stringify({ name: 'Home-made switch toy', condition: 7 }),
    })
    const offered = (await create.json()) as { id: string }
    await toysReq(`/${offered.id}`, family.token, {
      method: 'PATCH',
      body: JSON.stringify({ cover_photo_url: 'https://example.com/x.jpg', offer_type: 'exchange' }),
    })
    await toysReq(`/${offered.id}/publish`, family.token, { method: 'PATCH' })

    const { body: tx } = await requestToy(family.token, toyId, 'exchange', offered.id)
    await txReq(`/${tx.id}/accept`, leader.token, { method: 'POST', body: '{}' })

    // An exchange needs both parties, unlike a donation. Each recites the code
    // the OTHER one is holding — which is why each view carries only its own
    // and the test has to cross them over.
    const leaderView = (await (await txReq(`/${tx.id}`, leader.token)).json()) as any
    const familyView = (await (await txReq(`/${tx.id}`, family.token)).json()) as any

    const byFamily = await txReq(`/${tx.id}/confirm`, family.token, {
      method: 'POST',
      body: JSON.stringify({ code: leaderView.owner_code }),
    })
    expect(byFamily.status).toBe(200)

    const done = await txReq(`/${tx.id}/confirm`, leader.token, {
      method: 'POST',
      body: JSON.stringify({ code: familyView.requester_code }),
    })
    expect(done.status).toBe(200)

    const { data: handedIn } = await adminClient()
      .from('toys')
      .select('owner_id, owner_org_id, quantity, status')
      .eq('id', offered.id)
      .single()
    expect(handedIn!.owner_org_id).toBe(orgId)
    expect(handedIn!.owner_id).toBeNull()
    expect(handedIn!.quantity).toBe(1)
    // Unlisted: a leader looks it over before it goes back into the library.
    expect(handedIn!.status).toBe('draft')

    await adminClient().from('toys').delete().eq('owner_id', family.id)
  })

  // A donation is confirmed by the giving side alone, using the requester's code.
  async function requesterCode(txId: string): Promise<string> {
    const { data } = await adminClient()
      .from('toy_transactions')
      .select('requester_code')
      .eq('id', txId)
      .single()
    return data!.requester_code as string
  }

  async function completeAsLeader(txId: string, token: string) {
    const res = await txReq(`/${txId}/confirm`, token, {
      method: 'POST',
      body: JSON.stringify({ code: await requesterCode(txId) }),
    })
    expect(res.status).toBe(200)
  }
})
