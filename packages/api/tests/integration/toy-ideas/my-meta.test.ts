/** my-challenges-meta: your ideas and joined challenges carry maker and post counts, and when you joined. */
// journeys: C15
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let author: TestUser
let maker: TestUser
let ideaId: string

beforeAll(async () => {
  const admin = adminClient()
  ;[author, maker] = await Promise.all([createTestUser(), createTestUser()])
  const { data } = await admin
    .from('toy_ideas')
    .insert({ author_id: author.id, title: 'Bubble machine', summary: 'One switch.', status: 'challenge' })
    .select('id')
    .single()
  ideaId = data!.id
  await admin.from('toy_idea_participants').insert({ idea_id: ideaId, profile_id: maker.id, joined_at: '2026-07-12T02:00:00Z' })
  await admin.from('toy_idea_messages').insert([
    { idea_id: ideaId, sender_id: maker.id, kind: 'user', body: 'A lever?' },
    { idea_id: ideaId, sender_id: author.id, kind: 'user', body: 'Yes.' },
  ])
})

afterAll(async () => {
  await adminClient().from('toy_ideas').delete().eq('id', ideaId)
  await Promise.all([author, maker].map((u) => deleteTestUser(u.id)))
})

const get = (path: string, token: string) => app.request(path, { headers: { Authorization: `Bearer ${token}` } })

describe('my challenges meta', () => {
  it("counts makers and the makers' posts on your own idea", async () => {
    const rows = (await (await get('/api/ideas/mine', author.token)).json()) as Array<{ id: string; maker_count: number; answer_count: number }>
    expect(rows.find((r) => r.id === ideaId)).toMatchObject({ maker_count: 1, answer_count: 1 })
  })

  it('says when you joined, with the same counts', async () => {
    const rows = (await (await get('/api/ideas/joined', maker.token)).json()) as Array<{ id: string; joined_at: string; maker_count: number; answer_count: number }>
    const row = rows.find((r) => r.id === ideaId)!
    expect(new Date(row.joined_at).toISOString()).toBe('2026-07-12T02:00:00.000Z')
    // The author's own reply is not a post, though a maker never sees author_id.
    expect(row).toMatchObject({ maker_count: 1, answer_count: 1 })
    // Still no review_note on a joined challenge (037), and no author_id (108).
    expect(row).not.toHaveProperty('review_note')
    expect(row).not.toHaveProperty('author_id')
  })
})
