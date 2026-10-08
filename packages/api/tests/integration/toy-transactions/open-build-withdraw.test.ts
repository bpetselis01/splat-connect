// journeys: K12
/**
 * Withdrawing a Makers wanted post nobody has claimed. 064 let an ownerless
 * build exist only while `requested`, so the withdraw update tripped
 * `toy_transactions_one_owner` and the route answered 500 (fixed in 133).
 * The widening is exactly one status on exactly one shape: every other
 * ownerless row stays illegal.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let family: TestUser
let maker: TestUser
let tutorialId: string

const post = (token: string, path: string, body: unknown = {}) =>
  app.request(`/api/toy-transactions${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

async function openRequest() {
  const res = await post(family.token, '/build', {
    tutorial_id: tutorialId,
    build_brief: 'Leo lights up at bubbles but I do not own a soldering iron.',
    requester_suburb: 'Newtown',
    travel_km: 10,
  })
  expect(res.status).toBe(201)
  return ((await res.json()) as { id: string }).id
}
const rowStatus = async (id: string) =>
  (await adminClient().from('toy_transactions').select('status').eq('id', id).single()).data!.status

beforeAll(async () => {
  family = await createTestUser('contributor')
  maker = await createTestUser('contributor')
  const { data } = await adminClient()
    .from('tutorials')
    .insert({ title: `Withdraw guide ${Date.now()}`, description: 'A guide', difficulty: 'easy', status: 'approved' })
    .select('id')
    .single()
  tutorialId = data!.id
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('toy_transactions').delete().eq('tutorial_id', tutorialId)
  await admin.from('tutorials').delete().eq('id', tutorialId)
  await Promise.all([deleteTestUser(family.id), deleteTestUser(maker.id)])
})

describe('withdrawing an unclaimed build post', () => {
  it('lets its author withdraw it, once', async () => {
    const id = await openRequest()
    const res = await post(family.token, `/${id}/withdraw`)
    expect(res.status).toBe(200)
    expect(await rowStatus(id)).toBe('withdrawn')
    expect((await post(family.token, `/${id}/withdraw`)).status).toBe(409)
  })

  it('still lets the family withdraw once a maker has claimed it', async () => {
    const id = await openRequest()
    expect((await post(maker.token, `/${id}/claim`)).status).toBe(200)
    expect((await post(family.token, `/${id}/withdraw`)).status).toBe(200)
    expect(await rowStatus(id)).toBe('withdrawn')
  })

  it('keeps every other ownerless row illegal', async () => {
    const admin = adminClient()
    const base = { tutorial_id: tutorialId, requester_id: family.id, owner_id: null, owner_org_id: null }
    for (const [type, status] of [
      ['donation', 'withdrawn'],
      ['donation', 'requested'],
      ['exchange', 'withdrawn'],
      ['print', 'withdrawn'],
      ['build', 'accepted'],
      ['build', 'rejected'],
      ['build', 'completed'],
    ] as const) {
      const { error } = await admin.from('toy_transactions').insert({ ...base, type, status })
      expect(error?.message, `${type}/${status}`).toContain('toy_transactions_one_owner')
    }
  })
})
