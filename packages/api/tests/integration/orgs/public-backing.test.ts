import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader, createProject, requestBacking, cleanupOrg } from '../../helpers/orgs.js'

let author: TestUser
let leader: TestUser
let orgA: string
let orgB: string
let published: string

beforeAll(async () => {
  author = await createTestUser('contributor')
  leader = await createTestUser('contributor')
  orgA = await createOrg({ createdBy: leader.id, name: 'Riverside Therapy' })
  await addLeader(orgA, leader.id)
  orgB = await createOrg({ createdBy: leader.id, name: 'Declining Clinic' })

  published = await createProject({ authorId: author.id, status: 'approved' })
  await requestBacking({ tutorialId: published, orgId: orgA, status: 'accepted' })
  await requestBacking({ tutorialId: published, orgId: orgB, status: 'declined' })
})

afterAll(async () => {
  await cleanupOrg(orgA, [published])
  await cleanupOrg(orgB)
  await deleteTestUser(author.id)
  await deleteTestUser(leader.id)
})

describe('GET /api/public/tutorials', () => {
  // Tests: the list carries accepted backing and nothing else
  // How:   one tutorial with one accepted and one declined row; unauthenticated
  // Chain: the library card is the only place a parent sees the badge before
  //        clicking, and a declined organisation must never appear to have
  //        endorsed anything
  it('carries accepted backing on each row, and never declined', async () => {
    const res = await app.request('/api/public/tutorials')
    expect(res.status).toBe(200)
    const rows = (await res.json()) as Array<{
      id: string
      tutorial_orgs?: Array<{ status: string; organizations: { name: string } }>
    }>
    const row = rows.find((r) => r.id === published)
    expect(row).toBeTruthy()

    const names = (row!.tutorial_orgs ?? []).map((b) => b.organizations.name)
    expect(names).toContain('Riverside Therapy')
    expect(names).not.toContain('Declining Clinic')
  })

  // Tests: the difficulty filter still works alongside the new embed
  // How:   requests ?difficulty=easy; checks the fixture (easy) comes back
  // Chain: the embed was added to a query that already had a conditional filter,
  //        and a select change is exactly where that kind of thing breaks quietly
  it('still honours the difficulty filter', async () => {
    const res = await app.request('/api/public/tutorials?difficulty=easy')
    expect(res.status).toBe(200)
    const rows = (await res.json()) as Array<{ id: string; difficulty: string }>
    expect(rows.map((r) => r.id)).toContain(published)
    expect(rows.every((r) => r.difficulty === 'easy')).toBe(true)
  })
})
