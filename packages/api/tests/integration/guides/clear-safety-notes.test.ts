// journeys: (none — route coverage; no journey row names this route yet)
/** DELETE /api/tutorials/:id/safety-notes clears a guide's safety notes for its contributors and touches no other guide. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'

let author: TestUser
let otherAuthor: TestUser
let stranger: TestUser
let guide: string
let neighbour: string

const clear = (id: string, token?: string) =>
  app.request(`/api/tutorials/${id}/safety-notes`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} })
const count = async (id: string) =>
  (await adminClient().from('tutorial_safety_notes').select('tutorial_id', { count: 'exact', head: true }).eq('tutorial_id', id)).count
const seed = async (id: string) => {
  const { error } = await adminClient().from('tutorial_safety_notes').insert([
    { tutorial_id: id, position: 1, title: 'Keep the battery door shut' },
    { tutorial_id: id, position: 2, title: 'Mind the hot glue', detail: 'It burns.' },
  ])
  if (error) throw new Error(error.message)
}

beforeAll(async () => {
  ;[author, otherAuthor, stranger] = await Promise.all([createTestUser('contributor'), createTestUser('contributor'), createTestUser('contributor')])
  guide = await createProject({ authorId: author.id, status: 'approved', title: 'Clear Safety Notes Fixture' })
  neighbour = await createProject({ authorId: otherAuthor.id, status: 'approved', title: 'Clear Safety Notes Neighbour' })
  await seed(guide)
  await seed(neighbour)
})
afterAll(async () => {
  await adminClient().from('tutorials').delete().in('id', [guide, neighbour])
  for (const u of [author, otherAuthor, stranger]) await deleteTestUser(u.id)
})

describe('clearing a guide’s safety notes', () => {
  it('needs a signed-in member', async () => {
    expect((await clear(guide)).status).toBe(401)
    expect(await count(guide)).toBe(2)
  })

  // Pinned as it behaves: the delete runs under the caller's JWT, so RLS
  // filters a stranger's delete to zero rows and the route still answers 204.
  it('answers a stranger with 204 and deletes nothing', async () => {
    expect((await clear(guide, stranger.token)).status).toBe(204)
    expect(await count(guide)).toBe(2)
  })

  it('removes every safety note from the contributor’s guide and leaves another guide’s alone', async () => {
    const res = await clear(guide, author.token)
    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')
    expect(await count(guide)).toBe(0)
    expect(await count(neighbour)).toBe(2)
  })

  it('answers 204 again when there is nothing left to clear', async () => {
    expect((await clear(guide, author.token)).status).toBe(204)
    expect(await count(guide)).toBe(0)
  })
})
