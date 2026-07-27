import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'
import { createUserClient } from '../../../src/supabase/user-client.js'
import { createOrg, addMember, createOrgTutorial, cleanupOrg } from '../../helpers/orgs.js'

let leader: TestUser
let otherLeader: TestUser
let member: TestUser
let orgId: string
let otherOrgId: string
let draftId: string

beforeAll(async () => {
  leader = await createTestUser('contributor')
  otherLeader = await createTestUser('contributor')
  member = await createTestUser('contributor')

  orgId = await createOrg({ createdBy: leader.id })
  await addMember({ orgId, userId: leader.id, orgRole: 'leader', status: 'approved' })
  await addMember({ orgId, userId: member.id, orgRole: 'member', status: 'approved' })

  otherOrgId = await createOrg({ createdBy: otherLeader.id })
  await addMember({ orgId: otherOrgId, userId: otherLeader.id, orgRole: 'leader', status: 'approved' })

  // A DRAFT, not pending: proves the read grant is not scoped to submitted work.
  draftId = await createOrgTutorial({ orgId, authorId: member.id, authorToken: member.token, status: 'draft' })
})

afterAll(async () => {
  await cleanupOrg(orgId, [draftId])
  await cleanupOrg(otherOrgId)
  await deleteTestUser(leader.id)
  await deleteTestUser(otherLeader.id)
  await deleteTestUser(member.id)
})

describe('leader read grant', () => {
  it("reads an unpublished tutorial belonging to their own org", async () => {
    const { data } = await createUserClient(leader.token)
      .from('tutorials')
      .select('id, status')
      .eq('id', draftId)
    expect(data).toHaveLength(1)
    expect(data?.[0].status).toBe('draft')
  })

  it("a leader of a different org cannot read it", async () => {
    const { data, error } = await createUserClient(otherLeader.token)
      .from('tutorials')
      .select('id')
      .eq('id', draftId)
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  it('the read grant survives probation, unlike the write grant', async () => {
    const probation = await createOrg({ createdBy: leader.id, trustLevel: 'probation' })
    await addMember({ orgId: probation, userId: leader.id, orgRole: 'leader', status: 'approved' })
    // The pin trigger requires the author be an approved member of the org being pinned to.
    await addMember({ orgId: probation, userId: member.id, orgRole: 'member', status: 'approved' })
    const t = await createOrgTutorial({ orgId: probation, authorId: member.id, authorToken: member.token })

    const { data } = await createUserClient(leader.token).from('tutorials').select('id').eq('id', t)
    expect(data).toHaveLength(1)

    await cleanupOrg(probation, [t])
  })
})
