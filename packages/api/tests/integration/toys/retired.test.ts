/**
 * Retired org toys: off the public library and out of the request flow, still
 * on the leader's own shelf with the reason. A person's toy cannot be retired.
 * Remove never erases delivery history: a toy any handover names stays.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader, createOrgToy, cleanupOrg } from '../../helpers/orgs.js'

let leader: TestUser
let family: TestUser
let orgId: string
let toyId: string
let personToy: string

const HISTORY = 'This toy has handovers on record, so it stays on the shelf as retired.'

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
