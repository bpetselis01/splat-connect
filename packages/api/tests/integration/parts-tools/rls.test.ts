import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { acceptTerms } from '../../helpers/orgs.js'

let owner: TestUser
let other: TestUser
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
  other = await createTestUser('contributor')
  // POST /api/tutorials is gated on contributor_terms.
  await acceptTerms(owner.id, 'contributor_terms')

  await app.request(
    '/api/tutorials',
    authed(owner.token, {
      method: 'POST',
      body: JSON.stringify({ id: tutorialId, title: 'Parts RLS', difficulty: 'easy' }),
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
  await deleteTestUser(other.id)
})

describe('parts and tools RLS', () => {
  it('owner can write parts on their own tutorial', async () => {
    const res = await app.request(
      `/api/tutorials/${tutorialId}/parts`,
      authed(owner.token, {
        method: 'POST',
        body: JSON.stringify({
          parts: [
            {
              name: 'Solder Wire',
              quantity: 1,
              is_optional: false,
              buy_links: [{ label: 'Jaycar', url: 'https://example.com/solder' }],
            },
          ],
        }),
      })
    )
    expect(res.status).toBe(201)
    expect(((await res.json()) as unknown[]).length).toBe(1)
  })

  it('owner can write tools on their own tutorial', async () => {
    const res = await app.request(
      `/api/tutorials/${tutorialId}/tools`,
      authed(owner.token, {
        method: 'POST',
        body: JSON.stringify({
          tools: [{ name: 'Soldering Iron', is_optional: false, buy_links: [] }],
        }),
      })
    )
    expect(res.status).toBe(201)
  })

  it("another contributor cannot write parts on someone else's tutorial, and cannot wipe them", async () => {
    const res = await app.request(
      `/api/tutorials/${tutorialId}/parts`,
      authed(other.token, {
        method: 'POST',
        body: JSON.stringify({
          parts: [{ name: 'Hijack', quantity: 9, is_optional: false, buy_links: [] }],
        }),
      })
    )
    expect(res.status).toBe(500)

    // The route deletes-then-inserts; RLS must have blocked the delete too —
    // the owner's part is still there.
    const { data } = await adminClient()
      .from('parts')
      .select('name')
      .eq('tutorial_id', tutorialId)
    expect(data?.length).toBe(1)
    expect(data?.[0].name).toBe('Solder Wire')
  })
})
