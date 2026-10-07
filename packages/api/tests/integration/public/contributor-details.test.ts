/**
 * contributor-profile-details: the showcase's guide rows carry their view
 * count (092's definer function, made readable on the public read here).
 */
// journeys: Q13
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let maker: TestUser
let tutorialId: string

beforeAll(async () => {
  const admin = adminClient()
  maker = await createTestUser()
  const { data } = await admin
    .from('tutorials')
    .insert({ title: 'Light-up drum', difficulty: 'easy', status: 'approved', build_minutes: 20 })
    .select('id')
    .single()
  tutorialId = data!.id
  await admin.from('tutorial_contributors').insert({ tutorial_id: tutorialId, profile_id: maker.id, role: 'primary' })
  await admin.from('tutorial_view_counts').insert({ tutorial_id: tutorialId, views: 2100 })
})

afterAll(async () => {
  await adminClient().from('tutorials').delete().eq('id', tutorialId)
  await deleteTestUser(maker.id)
})

describe('GET /api/public/contributors/:id — guide rows', () => {
  it('returns each guide with its view count and build time', async () => {
    const res = await app.request(`/api/public/contributors/${maker.id}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { tutorials: Array<{ id: string; view_count: number; build_minutes: number }>; created_at: string }
    expect(body.tutorials.find((t) => t.id === tutorialId)).toMatchObject({ view_count: 2100, build_minutes: 20 })
    expect(body.created_at).toBeTruthy()
  })
})
