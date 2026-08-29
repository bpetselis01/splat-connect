import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

/**
 * 048's constraints are the whole 3-cap, so they are tested against the real
 * database rather than a mock, along with the public route's filter — the one
 * piece of the design that decides what a parent can and cannot see.
 */
let owner: TestUser
const ownerTutorial = crypto.randomUUID()
const approved = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()]
const pending = crypto.randomUUID()

function post(ids: string[]) {
  return app.request(`/api/tutorials/${ownerTutorial}/recommendations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${owner.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ recommendations: ids.map((recommended_id) => ({ recommended_id })) }),
  })
}

beforeAll(async () => {
  owner = await createTestUser('contributor')
  const admin = adminClient()
  await admin.from('tutorials').insert([
    { id: ownerTutorial, title: 'Recommender', difficulty: 'easy', status: 'approved' },
    ...approved.map((id, i) => ({ id, title: `Approved ${i}`, difficulty: 'easy', status: 'approved' })),
    { id: pending, title: 'Still in review', difficulty: 'easy', status: 'pending' },
  ])
  await admin.from('tutorial_contributors').insert({ tutorial_id: ownerTutorial, profile_id: owner.id })
})

afterAll(async () => {
  await adminClient().from('tutorials').delete().in('id', [ownerTutorial, ...approved, pending])
  await deleteTestUser(owner.id)
})

describe('tutorial recommendations', () => {
  it('accepts three', async () => {
    expect((await post(approved)).status).toBe(201)
  })

  it('refuses a fourth', async () => {
    expect((await post([...approved, pending])).status).toBe(500)
  })

  it('refuses a self-reference', async () => {
    expect((await post([ownerTutorial])).status).toBe(500)
  })

  it('shows a parent only the approved targets, in position order', async () => {
    expect((await post([pending, approved[1], approved[0]])).status).toBe(201)
    const res = await app.request(`/api/public/tutorials/${ownerTutorial}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { tutorial_recommendations: { position: number; tutorials: { id: string } }[] }
    expect(body.tutorial_recommendations.map((r) => r.tutorials.id)).toEqual([approved[1], approved[0]])
  })

  it('shows the creator every target, unapproved ones included', async () => {
    const res = await app.request(`/api/tutorials/${ownerTutorial}`, {
      headers: { Authorization: `Bearer ${owner.token}` },
    })
    const body = (await res.json()) as { tutorial_recommendations: { tutorials: { id: string; status: string } }[] }
    expect(body.tutorial_recommendations.map((r) => r.tutorials.status)).toEqual(['pending', 'approved', 'approved'])
  })
})
