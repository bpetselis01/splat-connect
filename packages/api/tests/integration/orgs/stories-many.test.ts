/**
 * The public story list with more hosting organisations than fit in one
 * PostgREST URL (~300 uuids): the name lookup used to 414 and every byline
 * lost its organisation.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { adminClient, createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'

const COUNT = 350
const tag = `Story Org ${Date.now()}`
let author: TestUser
let orgIds: string[] = []

beforeAll(async () => {
  author = await createTestUser('contributor')
  const admin = adminClient()
  const { data: orgs, error: orgErr } = await admin
    .from('organizations')
    .insert(Array.from({ length: COUNT }, (_, i) => ({ name: `${tag} ${i}`, status: 'active', suburb: 'Crows Nest', state: 'NSW' })))
    .select('id, name')
  if (orgErr) throw orgErr
  orgIds = orgs!.map((o) => o.id)
  const { error } = await admin.from('org_stories').insert(
    orgs!.map((o) => ({
      org_id: o.id,
      kind: 'org_update',
      title: `Story ${o.name}`,
      summary: 'A summary.',
      body: 'A body.',
      byline: 'A maker',
      consent_confirmed: true,
      status: 'published',
      published_at: new Date().toISOString(),
      created_by: author.id,
    })),
  )
  if (error) throw error
})

afterAll(async () => {
  const admin = adminClient()
  for (let i = 0; i < orgIds.length; i += 100) {
    const ids = orgIds.slice(i, i + 100)
    await admin.from('org_stories').delete().in('org_id', ids)
    await admin.from('organizations').delete().in('id', ids)
  }
  await deleteTestUser(author.id)
})

describe('more than 300 organisations with a published story', () => {
  it('names the organisation on each story', async () => {
    const res = await app.request('/api/public/stories')
    expect(res.status).toBe(200)
    const rows = (await res.json()) as Array<{ title: string; org_name: string | null }>
    const row = rows.find((r) => r.title === `Story ${tag} ${COUNT - 1}`)!
    expect(row.org_name).toBe(`${tag} ${COUNT - 1}`)
  })
})
