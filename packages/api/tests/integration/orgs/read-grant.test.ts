import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'
import { createUserClient } from '../../../src/supabase/user-client.js'
import { createOrg, addLeader, createProject, requestBacking, cleanupOrg } from '../../helpers/orgs.js'

let author: TestUser
let leader: TestUser
let otherLeader: TestUser
let orgId: string
let otherOrgId: string
let offered: string
let unoffered: string

beforeAll(async () => {
  author = await createTestUser('contributor')
  leader = await createTestUser('contributor')
  otherLeader = await createTestUser('contributor')
  orgId = await createOrg({ createdBy: leader.id })
  await addLeader(orgId, leader.id)
  otherOrgId = await createOrg({ createdBy: otherLeader.id })
  await addLeader(otherOrgId, otherLeader.id)

  // A DRAFT, not pending: reading it is how a leader decides whether to back it.
  offered = await createProject({ authorId: author.id, status: 'draft' })
  await requestBacking({ tutorialId: offered, orgId })
  unoffered = await createProject({ authorId: author.id, status: 'draft' })
})

afterAll(async () => {
  await cleanupOrg(orgId, [offered, unoffered])
  await cleanupOrg(otherOrgId)
  await deleteTestUser(author.id)
  await deleteTestUser(leader.id)
  await deleteTestUser(otherLeader.id)
})

describe('the leader read grant', () => {
  it('reads a draft their org was asked to back', async () => {
    const { data } = await createUserClient(leader.token)
      .from('tutorials').select('id').eq('id', offered)
    expect((data ?? []).map((t) => t.id)).toContain(offered)
  })

  it('cannot read a draft nobody offered them', async () => {
    const { data } = await createUserClient(leader.token)
      .from('tutorials').select('id').eq('id', unoffered)
    expect(data ?? []).toHaveLength(0)
  })

  it('reads the contributor rows too, so the inner join in GET /api/tutorials holds', async () => {
    // GET /api/tutorials embeds tutorial_contributors!inner. An inner join over
    // rows RLS hides drops the parent, so without a contributor read grant the
    // leader's queue is silently empty even though the tutorial itself is visible.
    const db = createUserClient(leader.token)
    const { data: plain } = await db.from('tutorials').select('id').eq('id', offered)
    const { data: joined } = await db
      .from('tutorials')
      .select('id, tutorial_contributors!inner(profile_id)')
      .eq('id', offered)
    expect(plain).toHaveLength(1)
    expect(joined).toHaveLength(1)
  })

  it('a leader of another org cannot read the contributors either', async () => {
    const { data } = await createUserClient(otherLeader.token)
      .from('tutorial_contributors').select('profile_id').eq('tutorial_id', offered)
    expect(data ?? []).toHaveLength(0)
  })

  it('a leader of another org cannot read it either', async () => {
    const { data } = await createUserClient(otherLeader.token)
      .from('tutorials').select('id').eq('id', offered)
    expect(data ?? []).toHaveLength(0)
  })
})
