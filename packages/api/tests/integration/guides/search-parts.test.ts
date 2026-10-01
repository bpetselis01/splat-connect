import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'

let author: TestUser
let guide: string

beforeAll(async () => {
  author = await createTestUser('contributor')
  guide = await createProject({ authorId: author.id, status: 'approved', title: 'Search Parts Fixture' })
  await adminClient().from('parts').insert({ tutorial_id: guide, name: 'Jelly Bean switch', quantity: 1, is_optional: false, buy_links: [] })
})

afterAll(async () => {
  await adminClient().from('tutorials').delete().eq('id', guide)
  await deleteTestUser(author.id)
})

describe('GET /api/public/tutorials', () => {
  it('carries each guide’s part names so a search can match them', async () => {
    const res = await app.request('/api/public/tutorials')
    const rows = (await res.json()) as { id: string; parts: { name: string }[] }[]
    expect(rows.find((r) => r.id === guide)?.parts).toEqual([{ name: 'Jelly Bean switch' }])
  })
})
