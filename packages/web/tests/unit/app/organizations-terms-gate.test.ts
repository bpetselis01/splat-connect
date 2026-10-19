import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { AGREEMENT_VERSIONS } from '@splat-connect/types'

const { getUser, agreements } = vi.hoisted(() => ({ getUser: vi.fn(), agreements: vi.fn() }))
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser },
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ limit: agreements }) }) }) }) }),
  }),
}))

const { middleware } = await import('@/middleware')
const visit = (path: string) => middleware(new NextRequest(`http://localhost:3105${path}`))

beforeEach(() => {
  vi.clearAllMocks()
  getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  agreements.mockResolvedValue({ data: [], error: null })
})

describe('the organisations directory and the contributor terms gate', () => {
  it('WN03 sends a signed-in member without the current contributor terms to the terms page, keeping the path', async () => {
    const res = await visit('/organizations')
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3105/onboarding/contributor-terms?next=%2Forganizations')
  })

  it('WN03 gates the public profile the same way (the query string is dropped)', async () => {
    const res = await visit('/organizations/o1/public?x=1')
    expect(res.headers.get('location')).toBe(
      'http://localhost:3105/onboarding/contributor-terms?next=%2Forganizations%2Fo1%2Fpublic'
    )
  })

  it('WN03 lets a signed-out visitor through, which is the inconsistency the audit records (Q4)', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const res = await visit('/organizations')
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
    expect(agreements).not.toHaveBeenCalled()
  })

  it('WN03 lets a member with the current terms through', async () => {
    agreements.mockResolvedValue({ data: [{ id: 'a1' }], error: null })
    const res = await visit('/organizations')
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
    expect(AGREEMENT_VERSIONS.contributor_terms).toBeTruthy()
  })
})
