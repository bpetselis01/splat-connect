/** GET /api/public/map: a family's toy is pinned at its pickup suburb, for signed-in callers only. */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { MapPlace } from '@splat-connect/types'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

const get = (token?: string, query = '') =>
  app.request(`http://localhost/api/public/map${query}`, token ? { headers: { Authorization: `Bearer ${token}` } } : {})
const items = (places: MapPlace[]) => places.flatMap((p) => p.items.map((i) => ({ ...i, suburb: p.suburb, km: p.km })))

// Nominatim is never called from a test: its lookups answer "not found", so
// every row falls back to its postcode centre.
const realFetch = globalThis.fetch
vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) =>
  String(input).includes('nominatim.openstreetmap.org') ? Promise.resolve(new Response('[]')) : realFetch(input, init)
)

describe('GET /api/public/map', () => {
  let family: TestUser
  let toyId: string

  beforeAll(async () => {
    family = await createTestUser('contributor')
    const admin = adminClient()
    const { error: pe } = await admin
      .from('profiles')
      .update({ pickup_line1: '1 Test St', pickup_suburb: 'newtown', pickup_state: 'NSW', pickup_postcode: '2042' })
      .eq('id', family.id)
    expect(pe).toBeNull()
    const { data, error } = await admin
      .from('toys')
      .insert({ owner_id: family.id, name: 'Map test toy', condition: 7, status: 'published', photo_urls: ['https://example.com/a.jpg'], offer_type: 'donation' })
      .select('id')
      .single()
    expect(error).toBeNull()
    toyId = data!.id
  })

  afterAll(async () => {
    await adminClient().from('toys').delete().eq('id', toyId)
    await deleteTestUser(family.id)
  })

  it('Q11 signed in: the family toy sits in its pickup suburb, with distance from near', async () => {
    const res = await get(family.token, '?near=2000')
    expect(res.status).toBe(200)
    const toy = items((await res.json()) as MapPlace[]).find((i) => i.id === toyId)
    expect(toy).toMatchObject({ kind: 'toy', title: 'Map test toy', suburb: 'Newtown' })
    expect(toy!.km).toBeGreaterThanOrEqual(2)
    expect(toy).not.toHaveProperty('postcode')
  })

  it('Q11 signed out: no family toys and no distance', async () => {
    const res = await get(undefined, '?near=2000')
    expect(res.status).toBe(200)
    const all = items((await res.json()) as MapPlace[])
    expect(all.find((i) => i.id === toyId)).toBeUndefined()
    expect(all.every((i) => i.km === null)).toBe(true)
  })

  it('a malformed near is a 400', async () => {
    expect((await get(family.token, '?near=abc')).status).toBe(400)
  })
})
