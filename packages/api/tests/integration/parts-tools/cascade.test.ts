import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let owner: TestUser
const tutorialId = crypto.randomUUID()

beforeAll(async () => {
  owner = await createTestUser('contributor')
  const admin = adminClient()

  await admin.from('tutorials').insert({
    id: tutorialId,
    title: 'Cascade Me',
    difficulty: 'hard',
    status: 'draft',
  })
  await admin
    .from('tutorial_contributors')
    .insert({ tutorial_id: tutorialId, profile_id: owner.id })
  await admin
    .from('parts')
    .insert({ tutorial_id: tutorialId, name: 'Part A', quantity: 1, is_optional: false, buy_links: [] })
  await admin
    .from('tools')
    .insert({ tutorial_id: tutorialId, name: 'Tool A', is_optional: false, buy_links: [] })
  await admin
    .from('stl_files')
    .insert({ tutorial_id: tutorialId, filename: 'a.stl', file_url: 'https://example.com/a.stl' })
})

afterAll(async () => {
  // tutorial should already be gone; this is crash-cleanup insurance
  await adminClient().from('tutorials').delete().eq('id', tutorialId)
  await deleteTestUser(owner.id)
})

describe('tutorial delete cascade', () => {
  it('deleting a draft tutorial removes its parts, tools, and stl_files', async () => {
    const res = await app.request(`/api/tutorials/${tutorialId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${owner.token}` },
    })
    expect(res.status).toBe(204)

    const admin = adminClient()
    for (const table of ['tutorials', 'parts', 'tools', 'stl_files'] as const) {
      const column = table === 'tutorials' ? 'id' : 'tutorial_id'
      const { count } = await admin
        .from(table)
        .select(column, { count: 'exact', head: true })
        .eq(column, tutorialId)
      expect(count, `${table} should be empty`).toBe(0)
    }
  })
})
