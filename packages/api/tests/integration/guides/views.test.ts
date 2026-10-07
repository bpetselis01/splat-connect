// journeys: T01
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'

let author: TestUser
let guide: string

beforeAll(async () => {
  author = await createTestUser('contributor')
  guide = await createProject({ authorId: author.id, status: 'approved', title: 'Views Fixture' })
})
afterAll(async () => {
  await adminClient().from('tutorials').delete().eq('id', guide)
  await deleteTestUser(author.id)
})

describe('092 tutorial_view_counts', () => {
  it('counts every public read without touching the guide', async () => {
    const before = (await adminClient().from('tutorials').select('updated_at').eq('id', guide).single()).data!.updated_at
    await app.request(`/api/public/tutorials/${guide}`)
    await app.request(`/api/public/tutorials/${guide}`)
    const { data } = await adminClient().from('tutorials').select('view_count, updated_at').eq('id', guide).single()
    expect(data).toEqual({ view_count: 2, updated_at: before })
  })

  it('shows the count on the author’s own list', async () => {
    const res = await app.request('/api/tutorials/mine', { headers: { Authorization: `Bearer ${author.token}` } })
    const row = ((await res.json()) as { id: string; view_count: number }[]).find((r) => r.id === guide)
    expect(row?.view_count).toBe(2)
  })

  it('cannot be bumped by a client', async () => {
    const anon = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)
    const { error } = await anon.rpc('bump_tutorial_view', { p_tutorial_id: guide })
    expect(error).not.toBeNull()
  })
})
