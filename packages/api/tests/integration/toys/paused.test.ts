/**
 * Mark unavailable: still listed and readable, but no new requests. Pausing is
 * the holder's own column, and it does not travel with the toy.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let owner: TestUser
let asker: TestUser
const toyIds: string[] = []

const call = (u: TestUser, path: string, method: string, body?: unknown) =>
  app.request(path, {
    method,
    headers: { Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
const publishedToy = async (ownerId: string, offer = 'donation') => {
  const id = (
    await adminClient()
      .from('toys')
      .insert({ owner_id: ownerId, name: 'Drum', condition: 8, photo_urls: ['https://example.com/d.jpg'], offer_type: offer, status: 'published' })
      .select('id')
      .single()
  ).data!.id as string
  toyIds.push(id)
  return id
}

beforeAll(async () => {
  owner = await createTestUser('contributor')
  asker = await createTestUser('contributor')
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('toy_transactions').delete().in('toy_id', toyIds)
  await admin.from('toys').delete().in('id', toyIds)
  await deleteTestUser(owner.id)
  await deleteTestUser(asker.id)
})

describe('100 toy paused', () => {
  it('has the column', async () => {
    const { error } = await adminClient().from('toys').select('paused_at').limit(1)
    expect(error).toBeNull()
  })

  it('refuses requests while paused, stays readable, and takes them again once resumed', async () => {
    const id = await publishedToy(owner.id)
    const paused = await call(owner, `/api/toys/${id}`, 'PATCH', { paused_at: new Date().toISOString() })
    expect(paused.status).toBe(200)
    expect(((await paused.json()) as { paused_at: string | null }).paused_at).not.toBeNull()

    const ask = await call(asker, '/api/toy-transactions', 'POST', { toy_id: id, type: 'donation' })
    expect(ask.status).toBe(409)
    expect(((await ask.json()) as { error: string }).error).toBe('This toy is not taking requests right now')

    const pub = await app.request(`/api/public/toys/${id}`)
    expect(pub.status).toBe(200)
    expect(((await pub.json()) as { paused_at: string | null }).paused_at).not.toBeNull()

    expect((await call(owner, `/api/toys/${id}`, 'PATCH', { paused_at: null })).status).toBe(200)
    expect((await call(asker, '/api/toy-transactions', 'POST', { toy_id: id, type: 'donation' })).status).toBe(201)
  })

  it('refuses a pause that is not a date', async () => {
    const id = await publishedToy(owner.id)
    expect((await call(owner, `/api/toys/${id}`, 'PATCH', { paused_at: 'soon' })).status).toBe(400)
  })

  it('arrives un-paused when it changes hands in an exchange', async () => {
    const wanted = await publishedToy(owner.id, 'exchange')
    const offered = await publishedToy(asker.id)
    await adminClient().from('toys').update({ paused_at: new Date().toISOString() }).eq('id', offered)
    const { data: tx } = await adminClient()
      .from('toy_transactions')
      .insert({
        toy_id: wanted, offered_toy_id: offered, type: 'exchange', status: 'accepted', requester_id: asker.id,
        owner_id: owner.id, owner_code: '111111', requester_code: '222222',
      })
      .select('id')
      .single()
    expect((await call(owner, `/api/toy-transactions/${tx!.id}/confirm`, 'POST', { code: '222222' })).status).toBe(200)
    expect((await call(asker, `/api/toy-transactions/${tx!.id}/confirm`, 'POST', { code: '111111' })).status).toBe(200)
    const { data: moved } = await adminClient().from('toys').select('owner_id, paused_at').eq('id', offered).single()
    expect(moved).toEqual({ owner_id: owner.id, paused_at: null })
  })
})
