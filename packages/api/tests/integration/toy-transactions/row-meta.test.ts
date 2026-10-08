/**
 * Makers wanted rows carry the guide's build time and rough parts cost — the
 * cost only when every required part is priced (batch 1's partsTotalCents).
 */
// journeys: X01
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let family: TestUser
let maker: TestUser
const guides: string[] = []

const guide = async (prices: (number | null)[]) => {
  const db = adminClient()
  const { data, error } = await db
    .from('tutorials')
    .insert({ title: `Meta ${Date.now()}`, description: 'G', difficulty: 'easy', status: 'approved', build_minutes: 20 })
    .select('id')
    .single()
  if (error) throw error
  const id = data.id as string
  guides.push(id)
  const parts = await db
    .from('parts')
    .insert(prices.map((price_cents, i) => ({ tutorial_id: id, name: `Part ${i}`, quantity: 1, is_optional: false, price_cents })))
  if (parts.error) throw parts.error
  const ask = await db.from('toy_transactions').insert({
    type: 'build', status: 'requested', tutorial_id: id, requester_id: family.id, travel_km: 10, requester_suburb: 'Newtown',
  })
  if (ask.error) throw ask.error
  return id
}

beforeAll(async () => {
  family = await createTestUser('contributor')
  maker = await createTestUser('contributor')
})

afterAll(async () => {
  const db = adminClient()
  await db.from('toy_transactions').delete().in('tutorial_id', guides)
  await db.from('parts').delete().in('tutorial_id', guides)
  await db.from('tutorials').delete().in('id', guides)
  await deleteTestUser(family.id)
  await deleteTestUser(maker.id)
})

describe('open-builds row meta', () => {
  it('carries build time and the parts total, and no total when a required part is unpriced', async () => {
    const priced = await guide([1500, 1300])
    const unpriced = await guide([1500, null])
    const res = await app.request('/api/toy-transactions/open-builds', { headers: { Authorization: `Bearer ${maker.token}` } })
    expect(res.status).toBe(200)
    const rows = (await res.json()) as { tutorial_id: string; tutorial: { build_minutes: number; parts_total_cents: number | null } }[]
    expect(rows.find((r) => r.tutorial_id === priced)!.tutorial).toMatchObject({ build_minutes: 20, parts_total_cents: 2800 })
    expect(rows.find((r) => r.tutorial_id === unpriced)!.tutorial).toMatchObject({ build_minutes: 20, parts_total_cents: null })
  })
})
