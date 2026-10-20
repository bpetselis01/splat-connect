/**
 * PATCH /api/toys/:id/publish moves a draft Toy to published once it has a
 * photo, an offer type and, if switch-adapted, a photo that shows the switch.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let owner: TestUser
let other: TestUser
const ids: Record<string, string> = {}

const publish = (id: string, token: string) =>
  app.request(`/api/toys/${id}/publish`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } })
const status = async (id: string) => (await adminClient().from('toys').select('status').eq('id', id).single()).data!.status

beforeAll(async () => {
  owner = await createTestUser('contributor')
  other = await createTestUser('contributor')
  const toy = async (name: string, over: Record<string, unknown>) => {
    const { data, error } = await adminClient()
      .from('toys')
      .insert({ owner_id: owner.id, name, condition: 7, status: 'draft', photo_urls: ['https://example.invalid/a.jpg'], offer_type: 'donation', ...over })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    ids[name] = data.id
  }
  await toy('ready', {})
  await toy('bare', { photo_urls: [], offer_type: null })
  await toy('switch', { switch_adapted: true })
})
afterAll(async () => {
  await adminClient().from('toys').delete().in('id', Object.values(ids))
  for (const u of [owner, other]) await deleteTestUser(u.id)
})

describe('publishing a toy', () => {
  it('W09 lists every missing field and keeps the toy a draft', async () => {
    const bare = await publish(ids.bare, owner.token)
    expect(bare.status).toBe(400)
    expect(await bare.json()).toEqual({ error: 'Missing required fields', missing: ['A photo', 'Offer type'] })
    expect(await status(ids.bare)).toBe('draft')

    const noSwitch = await publish(ids.switch, owner.token)
    expect(noSwitch.status).toBe(400)
    expect(await noSwitch.json()).toEqual({ error: 'Missing required fields', missing: ['A photo showing the switch'] })
    expect(await status(ids.switch)).toBe('draft')
  })

  it('W09 treats someone else’s toy, an unknown id and a malformed id as not found', async () => {
    for (const id of [ids.ready, crypto.randomUUID(), 'not-a-uuid']) {
      const res = await publish(id, other.token)
      expect(res.status, id).toBe(404)
      expect(await res.json()).toEqual({ error: 'Not found' })
    }
    expect(await status(ids.ready)).toBe('draft')
  })

  it('W09 publishes the owner’s complete toy', async () => {
    const res = await publish(ids.ready, owner.token)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: ids.ready, status: 'published' })
    expect(await status(ids.ready)).toBe('published')
  })
})
