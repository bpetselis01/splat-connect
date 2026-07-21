import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let owner: TestUser
const tutorialId = crypto.randomUUID()

const authed = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(init.headers ?? {}),
  },
})

beforeAll(async () => {
  owner = await createTestUser('contributor')
})

afterAll(async () => {
  await adminClient().from('tutorials').delete().eq('id', tutorialId)
  await deleteTestUser(owner.id)
})

describe('submit retry idempotency', () => {
  it('re-POSTing the same tutorial id returns 200 without a duplicate row', async () => {
    const body = JSON.stringify({ id: tutorialId, title: 'Retry Me', difficulty: 'easy' })

    const first = await app.request('/api/tutorials', authed(owner.token, { method: 'POST', body }))
    expect(first.status).toBe(201)

    const second = await app.request('/api/tutorials', authed(owner.token, { method: 'POST', body }))
    expect(second.status).toBe(200)
    expect(((await second.json()) as { id: string }).id).toBe(tutorialId)

    const { count } = await adminClient()
      .from('tutorials')
      .select('id', { count: 'exact', head: true })
      .eq('id', tutorialId)
    expect(count).toBe(1)
  })

  it('re-linking the same contributor returns 200 without a duplicate link', async () => {
    const first = await app.request(
      `/api/contributors/me/tutorials/${tutorialId}`,
      authed(owner.token, { method: 'POST' })
    )
    expect(first.status).toBe(201)

    const second = await app.request(
      `/api/contributors/me/tutorials/${tutorialId}`,
      authed(owner.token, { method: 'POST' })
    )
    expect(second.status).toBe(200)

    const { count } = await adminClient()
      .from('tutorial_contributors')
      .select('tutorial_id', { count: 'exact', head: true })
      .eq('tutorial_id', tutorialId)
    expect(count).toBe(1)
  })
})
