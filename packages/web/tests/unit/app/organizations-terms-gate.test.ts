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
  it('WN03 lets a signed-in member without the current contributor terms read the directory and a public profile', async () => {
    for (const path of ['/organizations', '/organizations/o1/public?x=1']) {
      const res = await visit(path)
      expect(res.status).toBe(200)
      expect(res.headers.get('location')).toBeNull()
    }
    expect(agreements).not.toHaveBeenCalled()
  })

  it('WN03 still gates /dashboard for the same member', async () => {
    const res = await visit('/dashboard')
    expect(res.headers.get('location')).toBe('http://localhost:3105/onboarding/contributor-terms?next=%2Fdashboard')
  })

  it('WN03 lets a signed-out visitor through', async () => {
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
