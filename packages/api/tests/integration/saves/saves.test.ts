import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import app from '../../../src/app.js'

let owner: TestUser
let other: TestUser
let approvedId: string
let draftId: string

beforeAll(async () => {
  owner = await createTestUser('contributor')
  other = await createTestUser('contributor')

  // Authorship is tutorial_contributors, not a column on tutorials — the
  // approved row needs no contributor at all to be publicly readable.
  const { data: approved, error: approvedError } = await adminClient()
    .from('tutorials')
    .insert({ title: 'Approved guide', status: 'approved', difficulty: 'easy' })
    .select('id')
    .single()
  if (approvedError) throw new Error(`setup: ${approvedError.message}`)
  approvedId = approved!.id

  // The row RLS must hide from a saved list. Saving it is allowed — POST does
  // not verify visibility — but reading it back must not return it. `other` is
  // its only contributor, so `owner` cannot see it.
  const { data: draft, error: draftError } = await adminClient()
    .from('tutorials')
    .insert({ title: 'Draft guide', status: 'draft', difficulty: 'easy' })
    .select('id')
    .single()
  if (draftError) throw new Error(`setup: ${draftError.message}`)
  draftId = draft!.id
  await adminClient()
    .from('tutorial_contributors')
    .insert({ tutorial_id: draftId, profile_id: other.id, role: 'primary' })
})

afterAll(async () => {
  await adminClient().from('tutorials').delete().in('id', [approvedId, draftId])
  await Promise.all([owner, other].map((u) => deleteTestUser(u.id)))
})

const as = (u: TestUser, method = 'GET', body?: unknown) => ({
  method,
  headers: {
    Authorization: `Bearer ${u.token}`,
    ...(body ? { 'Content-Type': 'application/json' } : {}),
  },
  ...(body ? { body: JSON.stringify(body) } : {}),
})

describe('POST /api/saves', () => {
  it('saves, and saving the same thing twice is not an error', async () => {
    const body = { entity_type: 'tutorial', entity_id: approvedId }
    const first = await app.request('/api/saves', as(owner, 'POST', body))
    expect(first.status).toBe(201)
    const second = await app.request('/api/saves', as(owner, 'POST', body))
    expect(second.status).toBe(201)

    const { count } = await adminClient()
      .from('saves')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', owner.id)
    expect(count).toBe(1)
  })

  it('rejects an entity_type outside the enum', async () => {
    const res = await app.request(
      '/api/saves',
      as(owner, 'POST', { entity_type: 'banana', entity_id: approvedId })
    )
    expect(res.status).toBe(400)
  })

  it('rejects a body missing entity_id', async () => {
    const res = await app.request('/api/saves', as(owner, 'POST', { entity_type: 'tutorial' }))
    expect(res.status).toBe(400)
  })
})

describe('GET /api/saves/:slug', () => {
  it('returns the saved entity in the public list shape', async () => {
    const res = await app.request('/api/saves/tutorials', as(owner))
    expect(res.status).toBe(200)
    const rows = (await res.json()) as { id: string; title: string }[]
    expect(rows.map((r) => r.id)).toContain(approvedId)
    expect(rows.find((r) => r.id === approvedId)!.title).toBe('Approved guide')
  })

  it('silently drops a saved row RLS hides', async () => {
    await app.request(
      '/api/saves',
      as(owner, 'POST', { entity_type: 'tutorial', entity_id: draftId })
    )
    const res = await app.request('/api/saves/tutorials', as(owner))
    expect(res.status).toBe(200)
    const rows = (await res.json()) as { id: string }[]
    // The save row exists; someone else's draft is invisible to this caller, so
    // the list must not contain it and must not error. This is the only guard
    // on "a donated toy quietly leaves your list".
    expect(rows.map((r) => r.id)).not.toContain(draftId)
  })

  it('404s a slug that is not live', async () => {
    const res = await app.request('/api/saves/organisations', as(owner))
    expect(res.status).toBe(404)
  })

  it('returns an empty list rather than erroring when nothing is saved', async () => {
    const res = await app.request('/api/saves/toys', as(other))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })
})

describe('GET /api/saves/ids', () => {
  it('groups ids by slug, including ones the list would hide', async () => {
    const res = await app.request('/api/saves/ids', as(owner))
    expect(res.status).toBe(200)
    const ids = (await res.json()) as { tutorials: string[]; toys: string[]; challenges: string[] }
    expect(ids.tutorials).toContain(approvedId)
    expect(ids.tutorials).toContain(draftId)
    expect(ids.toys).toEqual([])
    expect(ids.challenges).toEqual([])
  })

  it('sees nothing of another account\'s saves', async () => {
    const res = await app.request('/api/saves/ids', as(other))
    const ids = (await res.json()) as { tutorials: string[] }
    expect(ids.tutorials).toEqual([])
  })
})

describe('DELETE /api/saves/:slug/:id', () => {
  it('removes your own save', async () => {
    const res = await app.request(`/api/saves/tutorials/${approvedId}`, as(owner, 'DELETE'))
    expect(res.status).toBe(204)
    const { count } = await adminClient()
      .from('saves')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', owner.id)
      .eq('entity_id', approvedId)
    expect(count).toBe(0)
  })

  it('cannot reach into someone else\'s saves', async () => {
    await app.request(
      '/api/saves',
      as(owner, 'POST', { entity_type: 'tutorial', entity_id: approvedId })
    )
    // Idempotent: nothing to delete is not an error, and RLS scopes the delete
    // to the caller's own rows, so the owner's identical save survives.
    const res = await app.request(`/api/saves/tutorials/${approvedId}`, as(other, 'DELETE'))
    expect(res.status).toBe(204)
    const { count } = await adminClient()
      .from('saves')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', owner.id)
      .eq('entity_id', approvedId)
    expect(count).toBe(1)
  })
})
