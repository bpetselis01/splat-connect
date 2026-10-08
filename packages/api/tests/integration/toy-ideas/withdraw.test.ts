/**
 * 107: an author reads their own idea at any status, and withdraws it while
 * nobody has reviewed it. Nothing else can withdraw anything.
 */
// journeys: C08 C09
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createUserClient } from '../../../src/supabase/client.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let author: TestUser
let stranger: TestUser
const ids: string[] = []

const call = (u: TestUser, path: string, method = 'GET') =>
  app.request(path, { method, headers: { Authorization: `Bearer ${u.token}` } })
const idea = async (status: string, review_note: string | null = null) => {
  const id = (
    await adminClient().from('toy_ideas').insert({ author_id: author.id, title: 'T', summary: 'S', status, review_note }).select('id').single()
  ).data!.id as string
  ids.push(id)
  return id
}
const exists = async (id: string) => !!(await adminClient().from('toy_ideas').select('id').eq('id', id).maybeSingle()).data

beforeAll(async () => {
  author = await createTestUser('contributor')
  stranger = await createTestUser('contributor')
})

afterAll(async () => {
  await adminClient().from('toy_ideas').delete().in('id', ids)
  await deleteTestUser(author.id)
  await deleteTestUser(stranger.id)
})

describe('GET /api/ideas/mine/:id', () => {
  it('gives the author their rejected idea with its reason, and nobody else anything', async () => {
    const id = await idea('rejected', 'Closer to a clinical aid.')
    const own = await call(author, `/api/ideas/mine/${id}`)
    expect(own.status).toBe(200)
    expect(await own.json()).toMatchObject({ id, status: 'rejected', review_note: 'Closer to a clinical aid.', photo_url: null })
    expect((await call(stranger, `/api/ideas/mine/${id}`)).status).toBe(404)
    expect((await call(author, '/api/ideas/mine/not-a-uuid')).status).toBe(404)
  })
})

describe('107 DELETE /api/ideas/:id', () => {
  it('withdraws the author’s pending idea', async () => {
    const id = await idea('pending')
    expect((await call(author, `/api/ideas/${id}`, 'DELETE')).status).toBe(204)
    expect(await exists(id)).toBe(false)
  })

  it('refuses anyone but the author, and leaves the idea', async () => {
    const id = await idea('pending')
    expect((await call(stranger, `/api/ideas/${id}`, 'DELETE')).status).toBe(404)
    expect((await call(stranger, '/api/ideas/not-a-uuid', 'DELETE')).status).toBe(404)
    expect(await exists(id)).toBe(true)
  })

  it('refuses an idea that has been reviewed, and says why', async () => {
    for (const status of ['challenge', 'rejected', 'graduated']) {
      const id = await idea(status)
      const res = await call(author, `/api/ideas/${id}`, 'DELETE')
      expect(res.status).toBe(409)
      expect(((await res.json()) as { error: string }).error).toBe('Only an idea still waiting for review can be withdrawn.')
      expect(await exists(id)).toBe(true)
    }
  })
})

describe('107 the policy itself, straight through PostgREST', () => {
  it('lets the author delete their pending idea and nothing else', async () => {
    const pending = await idea('pending')
    const live = await idea('challenge')
    const theirs = createUserClient(stranger.token)
    expect((await theirs.from('toy_ideas').delete().eq('id', pending).select('id')).data).toEqual([])
    const mine = createUserClient(author.token)
    expect((await mine.from('toy_ideas').delete().eq('id', live).select('id')).data).toEqual([])
    expect(await exists(live)).toBe(true)
    const { data, error } = await mine.from('toy_ideas').delete().eq('id', pending).select('id')
    expect(error).toBeNull()
    expect(data).toEqual([{ id: pending }])
  })
})
