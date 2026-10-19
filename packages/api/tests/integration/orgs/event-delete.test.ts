/** DELETE /api/organizations/:orgId/events/:id removes an event, and its questions with it, for a leader of that organisation only. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { addLeader, createOrg } from '../../helpers/orgs.js'

let leader: TestUser
let rival: TestUser
let orgId: string
let rivalOrgId: string
let eventId: string

const remove = (org: string, id: string, token: string) =>
  app.request(`/api/organizations/${org}/events/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
const exists = async (id: string) => (await adminClient().from('org_events').select('id').eq('id', id).maybeSingle()).data !== null

beforeAll(async () => {
  ;[leader, rival] = await Promise.all([createTestUser('contributor'), createTestUser('contributor')])
  orgId = await createOrg({ createdBy: leader.id })
  rivalOrgId = await createOrg({ createdBy: rival.id })
  await addLeader(orgId, leader.id)
  await addLeader(rivalOrgId, rival.id)
  const { data, error } = await adminClient()
    .from('org_events')
    .insert({ org_id: orgId, kind: 'workshop', title: 'Doomed workshop', starts_at: new Date(Date.now() + 864e5).toISOString(), format: 'in_person', location: 'A hall', status: 'draft', created_by: leader.id })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  eventId = data.id
  await adminClient().from('org_event_questions').insert({ event_id: eventId, position: 1, prompt: 'Allergies?', answer_type: 'short', required: false })
})
afterAll(async () => {
  await adminClient().from('organizations').delete().in('id', [orgId, rivalOrgId])
  for (const u of [leader, rival]) await deleteTestUser(u.id)
})

describe('deleting an organisation event', () => {
  it('L22 refuses another organisation’s leader, whether by their own org id or the right one, and keeps the event', async () => {
    for (const org of [rivalOrgId, orgId]) {
      const res = await remove(org, eventId, rival.token)
      expect(res.status, org).toBe(404)
      expect(await res.json()).toEqual({ error: 'No such event of yours.' })
    }
    expect(await exists(eventId)).toBe(true)
  })

  it('L22 answers an unknown event with a 404', async () => {
    const res = await remove(orgId, crypto.randomUUID(), leader.token)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'No such event of yours.' })
  })

  it('L22 deletes the leader’s event and its questions and returns the id', async () => {
    const res = await remove(orgId, eventId, leader.token)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: eventId })
    expect(await exists(eventId)).toBe(false)
    expect((await adminClient().from('org_event_questions').select('id').eq('event_id', eventId)).data).toEqual([])
  })
})
