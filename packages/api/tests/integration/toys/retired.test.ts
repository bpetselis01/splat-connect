/**
 * Retired org toys: off the public library and out of the request flow, still
 * on the leader's own shelf with the reason. A person's toy cannot be retired.
 * Remove never erases delivery history: a toy any handover names stays.
 */
// journeys: L09 W05
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader, createOrgToy, cleanupOrg } from '../../helpers/orgs.js'

let leader: TestUser
let family: TestUser
let orgId: string
let toyId: string
let personToy: string

const HISTORY = "This toy has handovers on record, so it can't be deleted."

const call = (u: TestUser, path: string, method: string, body?: unknown) =>
  app.request(path, {
    method,
    headers: { Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

const familyToy = async () =>
  (
    await adminClient()
      .from('toys')
      .insert({ owner_id: family.id, name: 'Drum', condition: 8, photo_urls: ['https://example.com/d.jpg'], offer_type: 'both', status: 'published' })
      .select('id')
      .single()
  ).data!.id as string

const handover = async (over: Record<string, unknown>) => {
  const { error } = await adminClient()
    .from('toy_transactions')
    .insert({ type: 'donation', status: 'requested', requester_id: family.id, owner_id: null, owner_org_id: orgId, ...over })
  if (error) throw new Error(error.message)
}

beforeAll(async () => {
  leader = await createTestUser('contributor')
  family = await createTestUser('contributor')
  orgId = await createOrg({ createdBy: leader.id })
  await addLeader(orgId, leader.id)
  toyId = await createOrgToy({ orgId, name: 'Spinning top' })
  personToy = await familyToy()
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('toys').delete().eq('owner_id', family.id)
  await cleanupOrg(orgId)
  await deleteTestUser(leader.id)
  await deleteTestUser(family.id)
})

describe('101 toy retired', () => {
  it('has the columns', async () => {
    const { error } = await adminClient().from('toys').select('retired_at, retired_note').limit(1)
    expect(error).toBeNull()
  })

  it('refuses a reason longer than 80 characters', async () => {
    const res = await call(leader, `/api/toys/${toyId}`, 'PATCH', { retired_at: new Date().toISOString(), retired_note: 'x'.repeat(81) })
    expect(res.status).toBe(400)
  })

  it('backs the 80-character limit in the database', async () => {
    const { error } = await adminClient().from('toys').update({ retired_note: 'x'.repeat(81) }).eq('id', toyId)
    expect(error).not.toBeNull()
  })

  it('takes a retired toy out of the library and the request flow, and keeps it on the shelf', async () => {
    const res = await call(leader, `/api/toys/${toyId}`, 'PATCH', { retired_at: new Date().toISOString(), retired_note: 'Broken 12 Aug' })
    expect(res.status).toBe(200)

    const list = (await (await app.request('/api/public/toys')).json()) as Array<{ id: string }>
    expect(list.map((t) => t.id)).not.toContain(toyId)
    expect((await app.request(`/api/public/toys/${toyId}`)).status).toBe(404)
    expect((await call(family, '/api/toy-transactions', 'POST', { toy_id: toyId, type: 'donation' })).status).toBe(404)

    const shelf = (await (await call(leader, '/api/toys/inventory', 'GET')).json()) as Array<{ id: string; retired_note: string | null }>
    expect(shelf.find((t) => t.id === toyId)?.retired_note).toBe('Broken 12 Aug')
  })

  it('does not let a person retire their own toy', async () => {
    const res = await call(family, `/api/toys/${personToy}`, 'PATCH', { retired_at: new Date().toISOString() })
    expect(res.status).toBe(200)
    expect(((await res.json()) as { retired_at: string | null }).retired_at).toBeNull()
  })
})

describe('Remove keeps delivery history', () => {
  it('refuses to delete a toy a handover names as the toy', async () => {
    const id = await createOrgToy({ orgId })
    await handover({ toy_id: id })
    const res = await call(leader, `/api/toys/${id}`, 'DELETE')
    expect(res.status).toBe(409)
    expect(((await res.json()) as { error: string }).error).toBe(HISTORY)
    expect((await adminClient().from('toys').select('id').eq('id', id).maybeSingle()).data).not.toBeNull()
  })

  it('refuses to delete a toy a handover names as the offered toy', async () => {
    const wanted = await createOrgToy({ orgId, offerType: 'exchange' })
    const offered = await familyToy()
    await handover({ toy_id: wanted, offered_toy_id: offered, type: 'exchange' })
    const res = await call(family, `/api/toys/${offered}`, 'DELETE')
    expect(res.status).toBe(409)
    expect(((await res.json()) as { error: string }).error).toBe(HISTORY)
  })

  it('deletes a toy with no handovers', async () => {
    const id = await createOrgToy({ orgId })
    const res = await call(leader, `/api/toys/${id}`, 'DELETE')
    expect(res.status).toBe(200)
    expect((await adminClient().from('toys').select('id').eq('id', id).maybeSingle()).data).toBeNull()
  })

  it('says on the shelf which toys have history', async () => {
    const fresh = await createOrgToy({ orgId })
    const used = await createOrgToy({ orgId })
    await handover({ toy_id: used })
    const shelf = (await (await call(leader, '/api/toys/inventory', 'GET')).json()) as Array<{ id: string; has_history: boolean }>
    expect(shelf.find((t) => t.id === fresh)?.has_history).toBe(false)
    expect(shelf.find((t) => t.id === used)?.has_history).toBe(true)
  })

  it('answers 404, not 409, to someone who does not hold the toy', async () => {
    const id = await createOrgToy({ orgId })
    await handover({ toy_id: id })
    expect((await call(family, `/api/toys/${id}`, 'DELETE')).status).toBe(404)
  })
})

describe('Retiring around open requests and past handovers', () => {
  const OPEN = 'This toy has open requests. Answer them first, then retire it.'

  it('refuses to retire a toy with an open request on it', async () => {
    const id = await createOrgToy({ orgId })
    await handover({ toy_id: id, status: 'accepted' })
    const res = await call(leader, `/api/toys/${id}`, 'PATCH', { retired_at: new Date().toISOString() })
    expect(res.status).toBe(409)
    expect(((await res.json()) as { error: string }).error).toBe(OPEN)
  })

  it('refuses to retire a toy offered in an open exchange', async () => {
    const id = await createOrgToy({ orgId })
    const wanted = await createOrgToy({ orgId, offerType: 'exchange' })
    await handover({ toy_id: wanted, offered_toy_id: id, type: 'exchange' })
    const res = await call(leader, `/api/toys/${id}`, 'PATCH', { retired_at: new Date().toISOString() })
    expect(res.status).toBe(409)
  })

  it('keeps a retired toy named in the past handover thread of the family it went to', async () => {
    const id = await createOrgToy({ orgId, name: 'Retired drum' })
    await handover({ toy_id: id, status: 'completed' })
    expect((await call(leader, `/api/toys/${id}`, 'PATCH', { retired_at: new Date().toISOString() })).status).toBe(200)
    // 033's "Transaction parties can view each other's toy" policy, OR'd with 101's.
    const txs = (await (await call(family, '/api/toy-transactions', 'GET')).json()) as Array<{ toy_id: string; toy_name: string }>
    expect(txs.find((t) => t.toy_id === id)?.toy_name).toBe('Retired drum')
  })
})

describe('A big shelf', () => {
  it('reads has_history across more toys than one URL holds', async () => {
    const rows = Array.from({ length: 260 }, (_, i) => ({
      name: `Bulk ${i}`, condition: 8, owner_id: null, owner_org_id: orgId, quantity: 1, offer_type: 'donation',
      photo_urls: ['https://example.com/b.jpg'], status: 'draft',
    }))
    const { data, error } = await adminClient().from('toys').insert(rows).select('id')
    if (error) throw new Error(error.message)
    const last = data![data!.length - 1].id as string
    await handover({ toy_id: last })
    const res = await call(leader, '/api/toys/inventory', 'GET')
    expect(res.status).toBe(200)
    const shelf = (await res.json()) as Array<{ id: string; has_history: boolean }>
    expect(shelf.find((t) => t.id === last)?.has_history).toBe(true)
  })
})

describe('Public profiles never carry the retire note', () => {
  const NOTE = 'Gone to the Nguyen family, broken'

  it("keeps a delivered, retired toy's note off the organisation and contributor pages", async () => {
    const id = await createOrgToy({ orgId, name: 'Delivered bell' })
    await handover({ toy_id: id, status: 'completed' })
    // The contributor page reads deliveries by owner_id; the same toy stands in.
    await handover({ toy_id: id, status: 'completed', owner_org_id: null, owner_id: family.id })
    await adminClient().from('profiles').update({ public_showcase: true }).eq('id', family.id)
    const { error } = await adminClient()
      .from('toys')
      .update({ retired_at: new Date().toISOString(), retired_note: NOTE })
      .eq('id', id)
    if (error) throw new Error(error.message)

    const org = await app.request(`/api/public/organizations/${orgId}`)
    expect(org.status).toBe(200)
    const orgText = await org.text()
    expect(orgText).toContain('Delivered bell')
    expect(orgText).not.toContain(NOTE)

    const delivered = (JSON.parse(orgText) as { toysDelivered: Array<Record<string, unknown>> }).toysDelivered
    expect(delivered.every((t) => !('retired_note' in t) && !('retired_at' in t))).toBe(true)

    const person = await app.request(`/api/public/contributors/${family.id}`)
    expect(person.status).toBe(200)
    const personText = await person.text()
    expect(personText).toContain('Delivered bell')
    expect(personText).not.toContain(NOTE)
    const given = (JSON.parse(personText) as { toysDelivered: Array<Record<string, unknown>> }).toysDelivered
    expect(given.every((t) => !('retired_note' in t) && !('retired_at' in t))).toBe(true)
  })
})
