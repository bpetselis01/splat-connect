/** GET /api/organizations/:id/pickup shows the fixed pickup point to a leader of that organisation only. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { addLeader, createOrg, setOrgPickup } from '../../helpers/orgs.js'

let leader: TestUser
let stranger: TestUser
let orgId: string

const read = (id: string, token: string) => app.request(`/api/organizations/${id}/pickup`, { headers: { Authorization: `Bearer ${token}` } })

beforeAll(async () => {
  leader = await createTestUser('contributor')
  stranger = await createTestUser('contributor')
  orgId = await createOrg({ createdBy: leader.id })
  await addLeader(orgId, leader.id)
  await setOrgPickup(orgId, { pickup_instructions: 'Side gate, code 4417' })
})
afterAll(async () => {
  await adminClient().from('organizations').delete().eq('id', orgId)
  for (const u of [leader, stranger]) await deleteTestUser(u.id)
})

describe('reading an organisation pickup point', () => {
  it('WB13 gives a leader the whole address and the instructions', async () => {
    const res = await read(orgId, leader.token)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      pickup_line1: '5 Association Way',
      pickup_suburb: 'Northbridge',
      pickup_state: 'NSW',
      pickup_postcode: '2063',
      pickup_instructions: 'Side gate, code 4417',
    })
  })

  it('answers a non-leader, an unknown organisation and a malformed id with the same 404', async () => {
    for (const [id, token] of [[orgId, stranger.token], [crypto.randomUUID(), leader.token], ['not-a-uuid', leader.token]]) {
      const res = await read(id, token)
      expect(res.status, id).toBe(404)
      expect(await res.json()).toEqual({ error: 'Not found' })
    }
  })

  it('needs a signed-in member', async () => {
    expect((await app.request(`/api/organizations/${orgId}/pickup`)).status).toBe(401)
  })
})
