/** GET /api/toy-transactions?role= narrows the caller's own exchanges to one side. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let viewer: TestUser
let other: TestUser
let asked: string
let given: string
let guide: string

const list = async (query = '') => {
  const res = await app.request(`/api/toy-transactions${query}`, { headers: { Authorization: `Bearer ${viewer.token}` } })
  return { status: res.status, body: (await res.json()) as { id: string }[] | { error: string } }
}
const ids = (b: unknown) => (b as { id: string }[]).map((r) => r.id).sort()

beforeAll(async () => {
  ;[viewer, other] = await Promise.all([createTestUser('contributor'), createTestUser('contributor')])
  const db = adminClient()
  const g = await db.from('tutorials').insert({ title: 'Role filter', description: 'G', difficulty: 'easy', status: 'approved' }).select('id').single()
  if (g.error) throw g.error
  guide = g.data.id
  const row = (requester_id: string, owner_id: string | null) =>
    db.from('toy_transactions')
      .insert({ type: 'build', status: 'requested', tutorial_id: guide, requester_id, owner_id, travel_km: 10, requester_suburb: 'Newtown' })
      .select('id').single()
  const a = await row(viewer.id, null)
  const b = await row(other.id, viewer.id)
  if (a.error) throw a.error
  if (b.error) throw b.error
  asked = a.data.id
  given = b.data.id
})

afterAll(async () => {
  const db = adminClient()
  await db.from('toy_transactions').delete().eq('tutorial_id', guide)
  await db.from('tutorials').delete().eq('id', guide)
  await Promise.all([deleteTestUser(viewer.id), deleteTestUser(other.id)])
})

describe('GET /api/toy-transactions role filter', () => {
  it('lists both sides with no role', async () => {
    expect(ids((await list()).body)).toEqual([asked, given].sort())
  })

  it('role=owner lists only the exchanges the caller is giving', async () => {
    expect(ids((await list('?role=owner')).body)).toEqual([given])
  })

  it('role=requester lists only the exchanges the caller asked for', async () => {
    expect(ids((await list('?role=requester')).body)).toEqual([asked])
  })

  it('answers 400 with a sentence for any other role', async () => {
    expect(await list('?role=banana')).toEqual({ status: 400, body: { error: "role must be 'owner' or 'requester'" } })
  })
})
