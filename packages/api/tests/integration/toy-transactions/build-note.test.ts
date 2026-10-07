/**
 * 104: a build request's note to the maker is optional. 061's subject check
 * still holds every other arm, and still caps a note at 2000 characters.
 */
// journeys: X01
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let family: TestUser
let tutorialId: string

const post = (body: unknown) =>
  app.request('/api/toy-transactions/build', {
    method: 'POST',
    headers: { Authorization: `Bearer ${family.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

beforeAll(async () => {
  family = await createTestUser('contributor')
  const { data } = await adminClient()
    .from('tutorials')
    .insert({ title: `Note guide ${Date.now()}`, description: 'G', difficulty: 'easy', status: 'approved' })
    .select('id')
    .single()
  tutorialId = data!.id
})

afterAll(async () => {
  await adminClient().from('toy_transactions').delete().eq('tutorial_id', tutorialId)
  await adminClient().from('tutorials').delete().eq('id', tutorialId)
  await deleteTestUser(family.id)
})

describe('104 build note optional', () => {
  it('posts an open request with no note', async () => {
    const res = await post({ tutorial_id: tutorialId, requester_suburb: 'Newtown', travel_km: 10, urgency: 'This month' })
    expect(res.status).toBe(201)
    const tx = (await res.json()) as { build_brief: string | null; urgency: string }
    expect(tx).toMatchObject({ build_brief: null, urgency: 'This month' })
  })

  it('refuses a note over 2000 characters, in a sentence', async () => {
    const res = await post({ tutorial_id: tutorialId, build_brief: 'x'.repeat(2001), requester_suburb: 'Newtown', travel_km: 10 })
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toBe('Keep the note to the maker to 2000 characters or fewer.')
  })

  it('keeps the database cap on a note that is present', async () => {
    const { error } = await adminClient().from('toy_transactions').insert({
      type: 'build', status: 'requested', tutorial_id: tutorialId, requester_id: family.id,
      build_brief: '   ', travel_km: 10, requester_suburb: 'Newtown',
    })
    expect(error?.message).toMatch(/toy_transactions_subject/)
  })
})
