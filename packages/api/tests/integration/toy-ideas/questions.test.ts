import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import app from '../../../src/app.js'

// 078: a question is a toy_idea of kind 'question' — answered in its thread,
// never graduated.

let asker: TestUser
let helper: TestUser
let stranger: TestUser
let admin: TestUser
let questionId: string
let challengeId: string
let replyId: string
let askerOwnId: string
const submitted: string[] = []

const base = { title: 'Glue?', summary: 'S', description: 'D', intended_use: 'U', primary_user: 'P' }

beforeAll(async () => {
  ;[asker, helper, stranger, admin] = await Promise.all([
    createTestUser('contributor'), createTestUser('contributor'),
    createTestUser('contributor'), createTestUser('admin'),
  ])
  const { data } = await adminClient().from('toy_ideas').insert([
    { ...base, author_id: asker.id, status: 'challenge', kind: 'question' },
    { ...base, author_id: asker.id, status: 'challenge', kind: 'challenge' },
  ]).select('id, kind')
  questionId = data!.find((r) => r.kind === 'question')!.id
  challengeId = data!.find((r) => r.kind === 'challenge')!.id
  await adminClient().from('toy_idea_participants').insert({ idea_id: questionId, profile_id: helper.id })
  const { data: msgs } = await adminClient().from('toy_idea_messages').insert([
    { idea_id: questionId, sender_id: helper.id, kind: 'user', body: 'A zip pocket.' },
    { idea_id: questionId, sender_id: asker.id, kind: 'user', body: 'Thanks!' },
  ]).select('id, sender_id')
  replyId = msgs!.find((m) => m.sender_id === helper.id)!.id
  askerOwnId = msgs!.find((m) => m.sender_id === asker.id)!.id
})

afterAll(async () => {
  await adminClient().from('toy_ideas').delete().in('id', [questionId, challengeId, ...submitted])
  await Promise.all([asker, helper, stranger, admin].map((u) => deleteTestUser(u.id)))
})

const post = (path: string, user: TestUser, body: unknown) =>
  app.request(path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('POST /api/ideas (kind)', () => {
  it('files a question when asked, and a challenge by default', async () => {
    const q = await post('/api/ideas', asker, { ...base, kind: 'question' })
    const c = await post('/api/ideas', asker, base)
    const [qBody, cBody] = (await Promise.all([q.json(), c.json()])) as { id: string; kind: string }[]
    submitted.push(qBody.id, cBody.id)
    expect(qBody.kind).toBe('question')
    expect(cBody.kind).toBe('challenge')
  })

  it('refuses an unknown kind', async () => {
    const res = await post('/api/ideas', asker, { ...base, kind: 'poll' })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/public/challenges', () => {
  it('carries kind and the maker and answer counts', async () => {
    const body = (await (await app.request('/api/public/challenges')).json()) as Record<string, unknown>[]
    const q = body.find((i) => i.id === questionId)!
    // The asker's own "Thanks!" is not an answer.
    expect(q).toMatchObject({ kind: 'question', maker_count: 1, answer_count: 1, answered_at: null })
    expect(q).not.toHaveProperty('author_id')
  })
})

describe('POST /api/ideas/:id/answer', () => {
  it('refuses anyone but the asker', async () => {
    expect((await post(`/api/ideas/${questionId}/answer`, helper, { message_id: replyId })).status).toBe(403)
    expect((await post(`/api/ideas/${questionId}/answer`, stranger, { message_id: replyId })).status).toBe(403)
  })

  it('refuses a build challenge', async () => {
    expect((await post(`/api/ideas/${challengeId}/answer`, asker, { message_id: replyId })).status).toBe(409)
  })

  it('refuses the asker\'s own message and a reply from another idea', async () => {
    expect((await post(`/api/ideas/${questionId}/answer`, asker, { message_id: askerOwnId })).status).toBe(404)
    expect((await post(`/api/ideas/${questionId}/answer`, asker, { message_id: crypto.randomUUID() })).status).toBe(404)
  })

  it('marks a reply, shows as answered publicly, then clears with null', async () => {
    const res = await post(`/api/ideas/${questionId}/answer`, asker, { message_id: replyId })
    expect(res.status).toBe(200)
    const detail = (await (await app.request(`/api/public/challenges/${questionId}`)).json()) as Record<string, unknown>
    expect(detail.answer_message_id).toBe(replyId)
    expect(detail.answered_at).not.toBeNull()
    expect(detail.answer_count).toBe(1)

    const cleared = await post(`/api/ideas/${questionId}/answer`, asker, { message_id: null })
    expect(await cleared.json()).toMatchObject({ answer_message_id: null, answered_at: null })
  })
})

describe('POST /api/admin/ideas/:id/graduate', () => {
  it('refuses a question', async () => {
    const res = await post(`/api/admin/ideas/${questionId}/graduate`, admin, {})
    expect(res.status).toBe(409)
    const { data } = await adminClient().from('toy_ideas').select('status').eq('id', questionId).single()
    expect(data!.status).toBe('challenge')
  })
})
