/** The toy's cover on one exchange, for the thread's header tile. */
// journeys: X01
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let owner: TestUser
let requester: TestUser
let toyId: string
let txId: string

beforeAll(async () => {
  owner = await createTestUser('contributor')
  requester = await createTestUser('contributor')
  const admin = adminClient()
  toyId = (
    await admin
      .from('toys')
      .insert({ owner_id: owner.id, name: 'Drum', condition: 8, photo_urls: ['https://example.com/cover.jpg'], offer_type: 'donation', status: 'published' })
      .select('id')
      .single()
  ).data!.id
  txId = (
    await admin
      .from('toy_transactions')
      .insert({ toy_id: toyId, type: 'donation', status: 'requested', requester_id: requester.id, owner_id: owner.id })
      .select('id')
      .single()
  ).data!.id
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('toy_transactions').delete().eq('id', txId)
  await admin.from('toys').delete().eq('id', toyId)
  await deleteTestUser(owner.id)
  await deleteTestUser(requester.id)
})

describe('GET /api/toy-transactions/:id', () => {
  it("carries the toy's cover photo to both parties", async () => {
    for (const u of [owner, requester]) {
      const res = await app.request(`/api/toy-transactions/${txId}`, { headers: { Authorization: `Bearer ${u.token}` } })
      expect(res.status).toBe(200)
      expect(((await res.json()) as { toy_cover_photo_url: string }).toy_cover_photo_url).toBe('https://example.com/cover.jpg')
    }
  })
})
