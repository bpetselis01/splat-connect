import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'
import app from '../../../src/app.js'

let author: TestUser
let tutorialId: string

beforeAll(async () => {
  author = await createTestUser('contributor')
})

afterAll(async () => {
  await deleteTestUser(author.id)
})

beforeEach(async () => {
  tutorialId = await createProject({ authorId: author.id, status: 'draft' })
})

function authed(token: string) {
  return { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
}

describe('PATCH /api/tutorials/:id — optimistic concurrency', () => {
  it('succeeds and bumps updated_at when the caller has the current version', async () => {
    const { data: current } = await adminClient().from('tutorials').select('updated_at').eq('id', tutorialId).single()
    const res = await app.request(`/api/tutorials/${tutorialId}`, {
      ...authed(author.token),
      method: 'PATCH',
      body: JSON.stringify({ title: 'Updated', updated_at: current!.updated_at }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { title: string; updated_at: string }
    expect(body.title).toBe('Updated')
    expect(new Date(body.updated_at).getTime()).toBeGreaterThan(new Date(current!.updated_at as string).getTime())
  })

  it('409s when the caller has a stale version', async () => {
    const { data: current } = await adminClient().from('tutorials').select('updated_at').eq('id', tutorialId).single()
    // Someone else saves first.
    await adminClient().from('tutorials').update({ title: 'Someone else\'s edit' }).eq('id', tutorialId)

    const res = await app.request(`/api/tutorials/${tutorialId}`, {
      ...authed(author.token),
      method: 'PATCH',
      body: JSON.stringify({ title: 'My edit', updated_at: current!.updated_at }),
    })
    expect(res.status).toBe(409)

    const { data: unchanged } = await adminClient().from('tutorials').select('title').eq('id', tutorialId).single()
    expect(unchanged?.title).toBe('Someone else\'s edit')
  })

  it('400s when updated_at is missing', async () => {
    const res = await app.request(`/api/tutorials/${tutorialId}`, {
      ...authed(author.token),
      method: 'PATCH',
      body: JSON.stringify({ title: 'No version' }),
    })
    expect(res.status).toBe(400)
  })
})
