import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { acceptTerms } from '../../helpers/orgs.js'

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
  // Submission is gated on contributor_terms, so a fixture that creates or
  // submits a tutorial has to accept them first.
  await acceptTerms(owner.id, 'contributor_terms')

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
    const { data: current } = await adminClient().from('tutorials').select('updated_at').eq('id', tutorialId).single()
    const res = await app.request(
      `/api/tutorials/${tutorialId}`,
      authed(owner.token, { method: 'PATCH', body: JSON.stringify({ status: 'pending', safety_declared: true, updated_at: current!.updated_at }) })
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      status: string
      reviewed_at: string | null
      rejection_note: string | null
    }
    expect(body.status).toBe('pending')
  })

  it('a draft with no safety declaration cannot be submitted', async () => {
    const { data: fresh } = await adminClient()
      .from('tutorials')
      .insert({ title: 'Undeclared', difficulty: 'easy', status: 'draft' })
      .select('id, updated_at')
      .single()
    await adminClient().from('tutorial_contributors').insert({ tutorial_id: fresh!.id, profile_id: owner.id, role: 'primary' })
    const res = await app.request(
      `/api/tutorials/${fresh!.id}`,
      authed(owner.token, { method: 'PATCH', body: JSON.stringify({ status: 'pending', updated_at: fresh!.updated_at }) })
    )
    expect(res.status).toBe(400)
    await adminClient().from('tutorials').delete().eq('id', fresh!.id)
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
    const body = (await res.json()) as {
      status: string
      reviewed_at: string | null
      rejection_note: string | null
    }
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
    const body = (await res.json()) as {
      status: string
      reviewed_at: string | null
      rejection_note: string | null
    }
    expect(body.status).toBe('rejected')
    expect(body.rejection_note).toBe('Too short')
  })
})
