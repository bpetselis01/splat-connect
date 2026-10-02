/** 119: a returned guide and a declined idea carry their reason to the one person they are about. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createUserClient } from '../../../src/supabase/client.js'

let admin: TestUser
let author: TestUser
let maker: TestUser
let tutorialId: string
let ideaId: string

const as = (token: string, method: string, body: unknown) => ({
  method,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

beforeAll(async () => {
  const sb = adminClient()
  ;[admin, author, maker] = await Promise.all([createTestUser('admin'), createTestUser(), createTestUser()])
  const { data: t } = await sb.from('tutorials').insert({ title: 'Fan', difficulty: 'easy', status: 'pending' }).select('id').single()
  tutorialId = t!.id
  await sb.from('tutorial_contributors').insert({ tutorial_id: tutorialId, profile_id: author.id, role: 'primary' })
  const { data: i } = await sb.from('toy_ideas').insert({ author_id: author.id, title: 'Spoon', summary: 'Grip.', status: 'pending' }).select('id').single()
  ideaId = i!.id
})

afterAll(async () => {
  const sb = adminClient()
  await sb.from('notifications').delete().in('recipient_id', [author.id, maker.id])
  await sb.from('tutorials').delete().eq('id', tutorialId)
  await sb.from('toy_ideas').delete().eq('id', ideaId)
  await Promise.all([admin, author, maker].map((u) => deleteTestUser(u.id)))
})

describe('119 notification body', () => {
  it('the column exists', async () => {
    const { error } = await adminClient().from('notifications').select('body').limit(1)
    expect(error).toBeNull()
  })

  it("carries a returned guide's reason, cut to 300", async () => {
    const reason = 'Step 4 does not say which wire goes to the tip. '.repeat(10)
    const res = await app.request(`/api/admin/tutorials/${tutorialId}/status`, as(admin.token, 'PATCH', { status: 'rejected', rejection_note: reason }))
    expect(res.status).toBe(200)
    const { data } = await adminClient().from('notifications').select('body').eq('recipient_id', author.id).eq('type', 'tutorial_rejected').single()
    expect(data!.body).toHaveLength(300)
    expect(data!.body!.startsWith('Step 4 does not say which wire')).toBe(true)
  })

  it("puts a declined idea's private reason on the author's row and nobody else's", async () => {
    const res = await app.request(`/api/admin/ideas/${ideaId}/status`, as(admin.token, 'PATCH', { status: 'rejected', review_note: 'Too close to an existing guide.' }))
    expect(res.status).toBe(200)
    const { data } = await adminClient().from('notifications').select('recipient_id, body').eq('idea_id', ideaId)
    expect(data).toEqual([{ recipient_id: author.id, body: 'Too close to an existing guide.' }])
  })

  it('a recipient may mark their row read but cannot rewrite its body', async () => {
    const { data: row } = await adminClient().from('notifications').select('id').eq('idea_id', ideaId).single()
    const userClient = createUserClient(author.token)
    const { error } = await userClient.from('notifications').update({ body: 'Rewritten.' }).eq('id', row!.id)
    expect(error).not.toBeNull()
    const { error: readError } = await userClient.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', row!.id)
    expect(readError).toBeNull()
    const { data } = await adminClient().from('notifications').select('body, read_at').eq('id', row!.id).single()
    expect(data!.body).toBe('Too close to an existing guide.')
    expect(data!.read_at).not.toBeNull()
  })
})
