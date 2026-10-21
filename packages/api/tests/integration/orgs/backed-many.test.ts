/**
 * An organisation's public page when it backs more guides than fit in one
 * PostgREST URL (~300 uuids). The per-leader "guides backed" count used to
 * read 0 because that lookup 414ed.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { adminClient, createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'

const COUNT = 350
const tag = `Backed Many ${Date.now()}`
let leader: TestUser
let orgId: string
let guideIds: string[] = []

beforeAll(async () => {
  leader = await createTestUser('contributor')
  const admin = adminClient()
  await admin.from('profiles').update({ name: 'Backing Leader' }).eq('id', leader.id)
  const org = await admin.from('organizations').insert({ name: tag, status: 'active', suburb: 'Crows Nest', state: 'NSW' }).select('id').single()
  if (org.error) throw org.error
  orgId = org.data.id
  const { error: leaderError } = await admin.from('org_leaders').insert({ org_id: orgId, user_id: leader.id })
  if (leaderError) throw leaderError
  const guides = await admin
    .from('tutorials')
    .insert(Array.from({ length: COUNT }, (_, i) => ({ title: `${tag} guide ${i}`, description: 'A guide', difficulty: 'easy', status: 'approved' })))
    .select('id')
  if (guides.error) throw guides.error
  guideIds = guides.data.map((g) => g.id)
  const { error } = await admin
    .from('tutorial_orgs')
    .insert(guideIds.map((tutorial_id) => ({ tutorial_id, org_id: orgId, status: 'accepted', responded_by: leader.id, responded_at: new Date().toISOString() })))
  if (error) throw error
})

afterAll(async () => {
  const admin = adminClient()
  for (let i = 0; i < COUNT; i += 100) {
    await admin.from('tutorial_orgs').delete().in('tutorial_id', guideIds.slice(i, i + 100))
    await admin.from('tutorials').delete().in('id', guideIds.slice(i, i + 100))
  }
  await admin.from('org_leaders').delete().eq('org_id', orgId)
  await admin.from('organizations').delete().eq('id', orgId)
  await deleteTestUser(leader.id)
})

describe('an organisation backing more than 300 guides', () => {
  it('counts every guide against the leader who accepted it', async () => {
    const res = await app.request(`/api/public/organizations/${orgId}`)
    expect(res.status).toBe(200)
    const org = (await res.json()) as { leaders: Array<{ name: string; guides_backed: number }> }
    expect(org.leaders).toEqual([{ name: 'Backing Leader', guides_backed: COUNT }])
  })
})
