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
      tutorial_contributors: Array<{ profile_id: string; profiles: { name: string } | null }>
      reviewer: { name: string } | null
    }
    expect(body.tutorial_contributors[0]?.profiles).not.toBeNull()
    // The byline links to /guides/contributor/[id] on mobile, which needs the
    // profile id alongside the name the embed already carried.
    expect(body.tutorial_contributors[0]?.profile_id).toBe(author.id)
    expect(body.reviewer).not.toBeNull()
  })

  it('keeps anything less mature than complete out of the default listing, but not the detail route', async () => {
    await adminClient().from('tutorials').update({ maturity: 'prototype' }).eq('id', tutorialId)
    const list = await app.request('/api/public/tutorials')
    const rows = (await list.json()) as Array<{ id: string }>
    expect(rows.some((t) => t.id === tutorialId)).toBe(false)

    const detail = await app.request(`/api/public/tutorials/${tutorialId}`)
    expect(detail.status).toBe(200)

    await adminClient().from('tutorials').update({ maturity: 'complete' }).eq('id', tutorialId)
    const relisted = await app.request('/api/public/tutorials')
    const relistedRows = (await relisted.json()) as Array<{ id: string }>
    expect(relistedRows.some((t) => t.id === tutorialId)).toBe(true)
  })
})
