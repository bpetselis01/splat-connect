import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getUserRole } from '@/lib/auth'

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}))

describe('getUserRole', () => {
  const mockGetUser = vi.fn()
  const mockSingle = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(cookies).mockResolvedValue({
      getAll: () => [],
      set: vi.fn(),
    } as any)

    vi.mocked(createServerClient).mockReturnValue({
      auth: { getUser: mockGetUser },
      from: () => ({
        select: () => ({
          eq: () => ({ single: mockSingle }),
        }),
      }),
    } as any)
  })

  it('returns null when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    expect(await getUserRole()).toBeNull()
  })

  it('returns null when profile row is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'no rows' } })
    expect(await getUserRole()).toBeNull()
  })

  it('returns contributor for a contributor user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({ data: { role: 'contributor' } })
    expect(await getUserRole()).toBe('contributor')
  })

  it('returns admin for an admin user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({ data: { role: 'admin' } })
    expect(await getUserRole()).toBe('admin')
  })

  it('returns null when Supabase throws', async () => {
    mockGetUser.mockRejectedValue(new Error('Supabase unavailable'))
    expect(await getUserRole()).toBeNull()
  })
})
