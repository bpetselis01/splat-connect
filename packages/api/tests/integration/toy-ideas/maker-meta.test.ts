/**
 * Maker rows on a public brief: each participant's role, and who is writing
 * the guide up once the challenge graduates.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let author: TestUser
let maker: TestUser
let ideaId: string
let tutorialId: string

beforeAll(async () => {
  author = await createTestUser('contributor')
  maker = await createTestUser('contributor')
  const admin = adminClient()
  tutorialId = (
    await admin.from('tutorials').insert({ title: 'Draft', description: 'D', difficulty: 'medium', status: 'draft' }).select('id, created_at').single()
  ).data!.id
  ideaId = (
    await admin
      .from('toy_ideas')
      .insert({ author_id: author.id, title: 'T', summary: 'S', status: 'graduated', tutorial_id: tutorialId })
      .select('id')
      .single()
  ).data!.id
  await admin.from('toy_idea_participants').insert({ idea_id: ideaId, profile_id: maker.id })
  await admin.from('tutorial_contributors').insert([
    { tutorial_id: tutorialId, profile_id: author.id, role: 'primary' },
    { tutorial_id: tutorialId, profile_id: maker.id, role: 'collaborator' },
  ])
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('toy_ideas').delete().eq('id', ideaId)
  await admin.from('tutorials').delete().eq('id', tutorialId)
  await deleteTestUser(author.id)
  await deleteTestUser(maker.id)
})

describe('GET /api/public/challenges/:id — maker meta', () => {
  it('C02 gives each participant their role, and names who is writing it up', async () => {
    const res = await app.request(`/api/public/challenges/${ideaId}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      participants: { profile_id: string; role: string }[]
      writing_up: { profile_id: string; name: string; started_at: string } | null
    }
    expect(body.participants).toEqual([expect.objectContaining({ profile_id: maker.id, role: 'contributor' })])
    expect(body.writing_up).toMatchObject({ profile_id: author.id })
    expect(typeof body.writing_up!.started_at).toBe('string')
  })

  it('has nobody writing up a challenge that has not graduated', async () => {
    await adminClient().from('toy_ideas').update({ status: 'challenge' }).eq('id', ideaId)
    const body = (await (await app.request(`/api/public/challenges/${ideaId}`)).json()) as { writing_up: unknown }
    expect(body.writing_up).toBeNull()
    await adminClient().from('toy_ideas').update({ status: 'graduated' }).eq('id', ideaId)
  })
})
