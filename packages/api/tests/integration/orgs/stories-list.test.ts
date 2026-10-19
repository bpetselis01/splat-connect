/** GET /api/organizations/:id/stories lists an organisation's stories, drafts included, newest first, for its leaders; others see only what is published. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { addLeader, createOrg } from '../../helpers/orgs.js'

let leader: TestUser
let member: TestUser
let orgId: string
let otherOrgId: string

const list = async (token: string) => {
  const res = await app.request(`/api/organizations/${orgId}/stories`, { headers: { Authorization: `Bearer ${token}` } })
  expect(res.status).toBe(200)
  return ((await res.json()) as Array<{ title: string; status: string; org_id: string }>).map((s) => [s.title, s.status, s.org_id])
}

beforeAll(async () => {
  ;[leader, member] = await Promise.all([createTestUser('contributor'), createTestUser('contributor')])
  orgId = await createOrg({ createdBy: leader.id })
  otherOrgId = await createOrg({ createdBy: leader.id })
  await addLeader(orgId, leader.id)
  const story = (org_id: string, title: string, status: string, ageDays: number) => ({
    org_id, title, status, kind: 'org_update', summary: 'One sentence.', body: 'A paragraph.', byline: 'A leader',
    consent_confirmed: true, created_by: leader.id, created_at: new Date(Date.now() - ageDays * 864e5).toISOString(),
    ...(status === 'published' ? { published_at: new Date().toISOString() } : {}),
  })
  const { error } = await adminClient().from('org_stories').insert([
    story(orgId, 'Old draft', 'draft', 3),
    story(orgId, 'Live story', 'published', 2),
    story(orgId, 'Newest draft', 'draft', 1),
    story(otherOrgId, 'Elsewhere', 'published', 0),
  ])
  if (error) throw new Error(error.message)
})
afterAll(async () => {
  await adminClient().from('organizations').delete().in('id', [orgId, otherOrgId])
  for (const u of [leader, member]) await deleteTestUser(u.id)
})

describe('listing an organisation’s stories', () => {
  it('L18 gives a leader every story of that organisation, newest first, and none of another’s', async () => {
    expect(await list(leader.token)).toEqual([
      ['Newest draft', 'draft', orgId],
      ['Live story', 'published', orgId],
      ['Old draft', 'draft', orgId],
    ])
  })

  it('L18 gives any other member only the published stories', async () => {
    expect(await list(member.token)).toEqual([['Live story', 'published', orgId]])
  })

  it('L18 gives an unknown organisation an empty list', async () => {
    const res = await app.request(`/api/organizations/${crypto.randomUUID()}/stories`, { headers: { Authorization: `Bearer ${member.token}` } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })
})
