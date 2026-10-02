/** saved-list-meta: a saved guide names its primary contributor, read by id. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let author: TestUser
let helper: TestUser
let saver: TestUser
let tutorialId: string

beforeAll(async () => {
  const admin = adminClient()
  ;[author, helper, saver] = await Promise.all([createTestUser(), createTestUser(), createTestUser()])
  await admin.from('profiles').update({ name: 'Rachel Kaur' }).eq('id', author.id)
  await admin.from('profiles').update({ name: 'Tom Beattie' }).eq('id', helper.id)
  const { data } = await admin
    .from('tutorials')
    .insert({ title: 'Light-up drum', difficulty: 'easy', status: 'approved', build_minutes: 20 })
    .select('id')
    .single()
  tutorialId = data!.id
  await admin.from('tutorial_contributors').insert([
    { tutorial_id: tutorialId, profile_id: author.id, role: 'primary' },
    { tutorial_id: tutorialId, profile_id: helper.id, role: 'collaborator' },
  ])
  await admin.from('saves').insert({ profile_id: saver.id, entity_type: 'tutorial', entity_id: tutorialId })
})

afterAll(async () => {
  await adminClient().from('tutorials').delete().eq('id', tutorialId)
  await Promise.all([author, helper, saver].map((u) => deleteTestUser(u.id)))
})

describe('GET /api/saves/tutorials', () => {
  it('names the primary contributor, never a collaborator, beside the build time', async () => {
    const res = await app.request('/api/saves/tutorials', { headers: { Authorization: `Bearer ${saver.token}` } })
    expect(res.status).toBe(200)
    const [row] = (await res.json()) as Array<{ id: string; author_name: string | null; build_minutes: number; difficulty: string }>
    expect(row).toMatchObject({ id: tutorialId, author_name: 'Rachel Kaur', build_minutes: 20, difficulty: 'easy' })
  })
})
