// journeys: (none — route coverage; no journey row names this route yet)
/** GET /api/public/tutorials/stats counts approved guides, their credited people and accepted backers. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, createProject, requestBacking } from '../../helpers/orgs.js'

type Stats = { guides: number; contributors: number; organisations: number }
const stats = async () => (await app.request('/api/public/tutorials/stats')).json() as Promise<Stats>

let author: TestUser
let collab: TestUser
let orgId: string
let pendingOrgId: string
const guides: string[] = []

beforeAll(async () => {
  author = await createTestUser('contributor')
  collab = await createTestUser('contributor')
  orgId = await createOrg({ createdBy: author.id })
  pendingOrgId = await createOrg({ createdBy: author.id })
})
afterAll(async () => {
  await adminClient().from('tutorials').delete().in('id', guides)
  await adminClient().from('organizations').delete().in('id', [orgId, pendingOrgId])
  for (const u of [author, collab]) await deleteTestUser(u.id)
})

describe('library stats', () => {
  it('counts an approved guide, both credited people and an accepted backer, and nothing else', async () => {
    const before = await stats()
    const approved = await createProject({ authorId: author.id, status: 'approved' })
    guides.push(approved)
    const { error } = await adminClient().from('tutorial_contributors').insert({ tutorial_id: approved, profile_id: collab.id, role: 'collaborator' })
    expect(error).toBeNull()
    await requestBacking({ tutorialId: approved, orgId, status: 'accepted' })
    await requestBacking({ tutorialId: approved, orgId: pendingOrgId, status: 'pending' })
    guides.push(await createProject({ authorId: author.id, status: 'draft' }))

    expect(await stats()).toEqual({
      guides: before.guides + 1,
      contributors: before.contributors + 2,
      organisations: before.organisations + 1,
    })
  })
})
