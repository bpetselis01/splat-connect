// journeys: (none — route coverage; no journey row names this route yet)
/** PATCH /api/organizations/:id/pickup sets the fixed pickup point: a leader only, and all four address fields or nothing. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { addLeader, createOrg, setOrgPickup } from '../../helpers/orgs.js'

let leader: TestUser
let stranger: TestUser
let orgId: string

const address = { pickup_line1: ' 9 Dock Rd ', pickup_suburb: 'Balmain', pickup_state: 'NSW', pickup_postcode: '2041', pickup_instructions: '  Ring twice  ' }
const patch = (id: string, token: string, body: unknown) =>
  app.request(`/api/organizations/${id}/pickup`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
const stored = async () =>
  (await adminClient().from('organizations').select('pickup_line1, pickup_suburb, pickup_state, pickup_postcode, pickup_instructions').eq('id', orgId).single()).data

beforeAll(async () => {
  leader = await createTestUser('contributor')
  stranger = await createTestUser('contributor')
  orgId = await createOrg({ createdBy: leader.id })
  await addLeader(orgId, leader.id)
  await setOrgPickup(orgId)
})
afterAll(async () => {
  await adminClient().from('organizations').delete().eq('id', orgId)
  for (const u of [leader, stranger]) await deleteTestUser(u.id)
})

describe('writing an organisation pickup point', () => {
  it('stores the trimmed address and returns it', async () => {
    const res = await patch(orgId, leader.token, address)
    expect(res.status).toBe(200)
    const expected = { pickup_line1: '9 Dock Rd', pickup_suburb: 'Balmain', pickup_state: 'NSW', pickup_postcode: '2041', pickup_instructions: 'Ring twice' }
    expect(await res.json()).toEqual(expected)
    expect(await stored()).toEqual(expected)
  })

  it('clears the instructions when they are blank, since only the address is required', async () => {
    const res = await patch(orgId, leader.token, { ...address, pickup_instructions: '   ' })
    expect(res.status).toBe(200)
    expect((await stored())!.pickup_instructions).toBeNull()
  })

  it('refuses a half-filled address, a non-object body, and changes nothing', async () => {
    const before = await stored()
    const half = await patch(orgId, leader.token, { ...address, pickup_postcode: ' ' })
    expect(half.status).toBe(400)
    expect(await half.json()).toEqual({ error: 'A complete pickup address is required' })
    const list = await patch(orgId, leader.token, [address])
    expect(list.status).toBe(400)
    expect(await list.json()).toEqual({ error: 'Body must be an object' })
    expect(await stored()).toEqual(before)
  })

  it('answers a non-leader and an unknown organisation with a 404 and writes nothing', async () => {
    const before = await stored()
    for (const [id, token] of [[orgId, stranger.token], [crypto.randomUUID(), leader.token]]) {
      const res = await patch(id, token, address)
      expect(res.status, id).toBe(404)
      expect(await res.json()).toEqual({ error: 'Not found' })
    }
    expect(await stored()).toEqual(before)
  })
})
