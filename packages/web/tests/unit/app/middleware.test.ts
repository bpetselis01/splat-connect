// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { getUser, agreementsQuery } = vi.hoisted(() => ({
  getUser: vi.fn(),
  agreementsQuery: vi.fn(),
}))
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser },
    from: (table: string) => {
      if (table !== 'user_agreements') throw new Error(`unexpected table ${table}`)
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'eq']) chain[m] = () => chain
      chain.limit = () => agreementsQuery()
      return chain
    },
  }),
}))

import { middleware } from '@/middleware'

const run = (path: string) => middleware(new NextRequest(`http://localhost:3105${path}`))
const signedIn = () => getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })

beforeEach(() => {
  vi.clearAllMocks()
  getUser.mockResolvedValue({ data: { user: null } })
  agreementsQuery.mockResolvedValue({ data: [{ id: 'a1' }], error: null })
})

describe('contributor terms gate', () => {
  it('WT17 sends a signed-out visitor from /upload to /login', async () => {
    const res = await run('/upload')
    expect(res.status).toBe(307)
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login')
  })

  it('WT17 sends a Member with no current contributor terms from /upload to the terms, carrying where they were going', async () => {
    signedIn()
    agreementsQuery.mockResolvedValue({ data: [], error: null })
    const res = await run('/upload?kind=assistive_tech')
    const to = new URL(res.headers.get('location')!)
    expect(to.pathname).toBe('/onboarding/contributor-terms')
    expect(to.searchParams.get('next')).toBe('/upload?kind=assistive_tech')
  })

  it('WT17 lets a Member who accepted the current terms through to /upload', async () => {
    signedIn()
    const res = await run('/upload')
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })

  it('gates the guide editor and /dashboard the same way, and leaves the public guide page alone', async () => {
    signedIn()
    agreementsQuery.mockResolvedValue({ data: [], error: null })
    expect(new URL((await run('/tutorials/abc/edit'))!.headers.get('location')!).searchParams.get('next')).toBe('/tutorials/abc/edit')
    expect(new URL((await run('/dashboard/tutorials'))!.headers.get('location')!).searchParams.get('next')).toBe('/dashboard/tutorials')
    expect((await run('/tutorials/abc')).headers.get('location')).toBeNull()
  })

  it('fails closed when the terms lookup fails', async () => {
    signedIn()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    agreementsQuery.mockResolvedValue({ data: null, error: { message: 'down' } })
    const to = new URL((await run('/upload'))!.headers.get('location')!)
    expect(to.pathname).toBe('/onboarding/contributor-terms')
    expect(to.search).toBe('?next=%2Fupload&retry=1')
  })
})
