/**
 * 110: constraints on a challenge — readable wherever the challenge is,
 * written by its author or a current maker, and nobody else.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let author: TestUser
let maker: TestUser
let stranger: TestUser
let ideaId: string

const add = (u: TestUser, body: unknown) =>
  app.request(`/api/ideas/${ideaId}/constraints`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

beforeAll(async () => {
  ;[author, maker, stranger] = await Promise.all([createTestUser('contributor'), createTestUser('contributor'), createTestUser('contributor')])
  ideaId = (
    await adminClient().from('toy_ideas').insert({ author_id: author.id, title: 'T', summary: 'S', status: 'challenge', anonymous: true }).select('id').single()
  ).data!.id
  await adminClient().from('toy_idea_participants').insert({ idea_id: ideaId, profile_id: maker.id })
})

afterAll(async () => {
  await adminClient().from('toy_ideas').delete().eq('id', ideaId)
  await Promise.all([author, maker, stranger].map((u) => deleteTestUser(u.id)))
})

describe('110 idea constraints', () => {
  it('takes one from the author and one from a maker who joined', async () => {
    expect((await add(author, { label: 'Fluid and electronics share one enclosure', note: 'Anything you add sits above the waterline.' })).status).toBe(201)
    expect((await add(maker, { label: 'It has to survive a fall' })).status).toBe(201)
  })

  it('refuses someone who has not joined', async () => {
    const res = await add(stranger, { label: 'Mine' })
    expect(res.status).toBe(403)
    expect(((await res.json()) as { error: string }).error).toBe('Only the author or a maker on this challenge can add a constraint.')
  })

  it('refuses an empty or over-long label and an over-long note, in a sentence', async () => {
    for (const body of [{ label: '  ' }, { label: 'x'.repeat(81) }]) {
      const res = await add(author, body)
      expect(res.status).toBe(400)
      expect(((await res.json()) as { error: string }).error).toBe('A constraint needs a name of up to 80 characters.')
    }
    expect((await add(author, { label: 'L', note: 'x'.repeat(301) })).status).toBe(400)
  })

  it('lists them on the public brief, oldest first, without who added them', async () => {
    const text = await (await app.request(`/api/public/challenges/${ideaId}`)).text()
    expect(JSON.parse(text).constraints.map((c: { label: string }) => c.label)).toEqual([
      'Fluid and electronics share one enclosure',
      'It has to survive a fall',
    ])
    expect(text).not.toContain(author.id)
  })

  it('lets anon read a constraint but not who added it', async () => {
    const anon = createClient(process.env.SUPABASE_URL ?? 'http://localhost:54321', process.env.SUPABASE_ANON_KEY ?? '')
    expect((await anon.from('toy_idea_constraints').select('label').eq('idea_id', ideaId)).data).toHaveLength(2)
    expect((await anon.from('toy_idea_constraints').select('added_by').eq('idea_id', ideaId)).error).not.toBeNull()
  })
})
