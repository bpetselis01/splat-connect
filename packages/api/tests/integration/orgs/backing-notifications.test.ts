import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader, createProject, requestBacking, cleanupOrg } from '../../helpers/orgs.js'

let author: TestUser
let leader: TestUser
let orgId: string
let acceptedGuide: string
let declinedGuide: string

const answer = (tutorialId: string, verb: 'accept' | 'decline') =>
  app.request(`/api/tutorials/${tutorialId}/orgs/${orgId}/${verb}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${leader.token}` },
  })

const notices = async (tutorialId: string) =>
  (await adminClient().from('notifications').select('*').eq('tutorial_id', tutorialId)).data ?? []

beforeAll(async () => {
  author = await createTestUser('contributor')
  leader = await createTestUser('contributor')
  orgId = await createOrg({ createdBy: leader.id })
  await addLeader(orgId, leader.id)
  acceptedGuide = await createProject({ authorId: author.id, status: 'draft', title: 'Accepted Guide' })
  declinedGuide = await createProject({ authorId: author.id, status: 'draft', title: 'Declined Guide' })
  await requestBacking({ tutorialId: acceptedGuide, orgId })
  await requestBacking({ tutorialId: declinedGuide, orgId })
})

afterAll(async () => {
  await cleanupOrg(orgId, [acceptedGuide, declinedGuide])
  await deleteTestUser(author.id)
  await deleteTestUser(leader.id)
})

describe('backing answers notify the author', () => {
  it('accept inserts backing_accepted once, even if answered again', async () => {
    expect((await answer(acceptedGuide, 'accept')).status).toBe(200)
    expect((await answer(acceptedGuide, 'accept')).status).toBe(200)

    const rows = await notices(acceptedGuide)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      recipient_id: author.id,
      type: 'backing_accepted',
      tutorial_title: 'Accepted Guide',
    })
    expect(rows[0].actor_name).toBeTruthy()
  })

  it('L05 decline marks the backing declined by the leader and inserts backing_declined', async () => {
    expect((await answer(declinedGuide, 'decline')).status).toBe(200)

    const { data: backing } = await adminClient().from('tutorial_orgs').select('status, responded_by').eq('tutorial_id', declinedGuide).eq('org_id', orgId).single()
    expect(backing).toEqual({ status: 'declined', responded_by: leader.id })

    const rows = await notices(declinedGuide)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ recipient_id: author.id, type: 'backing_declined' })
  })
})
