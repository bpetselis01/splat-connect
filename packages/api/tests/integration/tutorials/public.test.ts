import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader, createProject, cleanupOrg } from '../../helpers/orgs.js'

describe('GET /api/public/tutorials/:id', () => {
  let author: TestUser
  let leader: TestUser
  let orgId: string
  let tutorialId: string

  beforeAll(async () => {
    author = await createTestUser('contributor')
    leader = await createTestUser('contributor')
    orgId = await createOrg({ createdBy: leader.id, name: 'Public Tutorial Probe Org' })
    await addLeader(orgId, leader.id)
    tutorialId = await createProject({ authorId: author.id, status: 'approved' })
    await adminClient().from('tutorials').update({ reviewed_by: leader.id }).eq('id', tutorialId)
  })

  afterAll(async () => {
    await cleanupOrg(orgId, [tutorialId])
    await deleteTestUser(author.id)
    await deleteTestUser(leader.id)
  })

  it('serves an approved tutorial with the contributor and reviewer names embedded', async () => {
    const res = await app.request(`/api/public/tutorials/${tutorialId}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      tutorial_contributors: Array<{ profiles: { name: string } | null }>
      reviewer: { name: string } | null
    }
    expect(body.tutorial_contributors[0]?.profiles).not.toBeNull()
    expect(body.reviewer).not.toBeNull()
  })
})
