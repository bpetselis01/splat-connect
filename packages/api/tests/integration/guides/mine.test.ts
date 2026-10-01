import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'

let author: TestUser
let guide: string

beforeAll(async () => {
  author = await createTestUser('contributor')
  guide = await createProject({ authorId: author.id, status: 'draft', title: 'Mine Fixture' })
  await adminClient().from('parts').insert({ tutorial_id: guide, name: 'Switch', quantity: 1, is_optional: false, buy_links: [] })
})
afterAll(async () => {
  await adminClient().from('tutorials').delete().eq('id', guide)
  await deleteTestUser(author.id)
})

describe('GET /api/tutorials/mine', () => {
  it('carries what the row needs to count its sections', async () => {
    const res = await app.request('/api/tutorials/mine', { headers: { Authorization: `Bearer ${author.token}` } })
    const row = ((await res.json()) as Record<string, unknown[]>[]).find((r) => (r as unknown as { id: string }).id === guide)!
    expect(row.parts).toHaveLength(1)
    expect(row.tools).toEqual([])
    expect(row.stl_files).toEqual([])
    expect(row.steps).toEqual([])
  })
})
