import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let owner: TestUser
let adminUser: TestUser
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
  adminUser = await createTestUser('admin')

  await app.request(
    '/api/tutorials',
    authed(owner.token, {
      method: 'POST',
      body: JSON.stringify({ id: tutorialId, title: 'Status Flow', difficulty: 'medium' }),
    })
  )
  await app.request(
    `/api/contributors/me/tutorials/${tutorialId}`,
    authed(owner.token, { method: 'POST' })
  )
})

afterAll(async () => {
  await adminClient().from('tutorials').delete().eq('id', tutorialId)
  await deleteTestUser(owner.id)
  await deleteTestUser(adminUser.id)
})

describe('tutorial status flow', () => {
  it('owner can submit draft -> pending', async () => {
    const res = await app.request(
      `/api/tutorials/${tutorialId}`,
      authed(owner.token, { method: 'PATCH', body: JSON.stringify({ status: 'pending' }) })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('pending')
  })

  it('owner cannot self-approve (RLS WITH CHECK blocks)', async () => {
    const res = await app.request(
      `/api/tutorials/${tutorialId}`,
      authed(owner.token, { method: 'PATCH', body: JSON.stringify({ status: 'approved' }) })
    )
    expect(res.ok).toBe(false)

    // status unchanged in the database
    const { data } = await adminClient()
      .from('tutorials')
      .select('status')
      .eq('id', tutorialId)
      .single()
    expect(data?.status).toBe('pending')
  })

  it('admin can approve, setting reviewed_at', async () => {
    const res = await app.request(
      `/api/admin/tutorials/${tutorialId}/status`,
      authed(adminUser.token, { method: 'PATCH', body: JSON.stringify({ status: 'approved' }) })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('approved')
    expect(body.reviewed_at).toBeTruthy()
  })

  it('admin can reject with a note', async () => {
    const res = await app.request(
      `/api/admin/tutorials/${tutorialId}/status`,
      authed(adminUser.token, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'rejected', rejection_note: 'Too short' }),
      })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('rejected')
    expect(body.rejection_note).toBe('Too short')
  })
})
