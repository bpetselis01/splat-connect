/** DELETE /api/organizations/:orgId/stories/:id removes a story for a leader of that organisation only. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { addLeader, createOrg } from '../../helpers/orgs.js'

let leader: TestUser
let rival: TestUser
let orgId: string
let rivalOrgId: string
let storyId: string

const remove = (org: string, id: string, token: string) =>
  app.request(`/api/organizations/${org}/stories/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
const exists = async (id: string) => (await adminClient().from('org_stories').select('id').eq('id', id).maybeSingle()).data !== null

beforeAll(async () => {
  ;[leader, rival] = await Promise.all([createTestUser('contributor'), createTestUser('contributor')])
  orgId = await createOrg({ createdBy: leader.id })
  rivalOrgId = await createOrg({ createdBy: rival.id })
  await addLeader(orgId, leader.id)
  await addLeader(rivalOrgId, rival.id)
  const { data, error } = await adminClient()
    .from('org_stories')
    .insert({ org_id: orgId, kind: 'org_update', title: 'Doomed story', summary: 'One sentence.', body: 'A paragraph.', byline: 'A leader', status: 'draft', created_by: leader.id })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  storyId = data.id
})
afterAll(async () => {
  await adminClient().from('organizations').delete().in('id', [orgId, rivalOrgId])
  for (const u of [leader, rival]) await deleteTestUser(u.id)
})

describe('deleting an organisation story', () => {
  it('L22 refuses another organisation’s leader, by their own org id or the right one, and keeps the story', async () => {
    for (const org of [rivalOrgId, orgId]) {
      const res = await remove(org, storyId, rival.token)
      expect(res.status, org).toBe(404)
      expect(await res.json()).toEqual({ error: 'No such story of yours.' })
    }
    expect(await exists(storyId)).toBe(true)
  })

  it('L22 answers an unknown story with a 404', async () => {
    const res = await remove(orgId, crypto.randomUUID(), leader.token)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'No such story of yours.' })
  })

  it('L22 WB17 deletes the leader’s story and returns its id', async () => {
    const res = await remove(orgId, storyId, leader.token)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: storyId })
    expect(await exists(storyId)).toBe(false)
  })
})
