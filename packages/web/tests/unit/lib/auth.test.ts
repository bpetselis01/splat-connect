import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getUserRole } from '@/lib/auth'

// --- Mock strategy ---
// Two Next.js server-side modules are mocked: next/headers provides a fake cookies() function
// (the real one only works inside a server request context), and @supabase/ssr's createServerClient
// is replaced with a factory returning a fake Supabase client. This allows getUserRole to be
// called in a plain Vitest environment without a running Next.js server.
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

  // Tests: getUserRole returns null when Supabase reports no authenticated user
  // How:   mockGetUser returns { data: { user: null } }; checks result is null
  // Chain: server components call getUserRole to determine the nav bar state and page access →
  //        a null role causes the layout to render as unauthenticated (Library link only)
  it('returns null when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    expect(await getUserRole()).toBeNull()
  })

  // Tests: getUserRole returns null when the user is authenticated but has no profile row
  // How:   mockGetUser returns a user; mockSingle returns { data: null, error: { code: 'PGRST116' } }; checks null
  // Chain: users who authenticated but were never given a profile are treated as unauthenticated →
  //        they cannot access contributor or admin pages until a profile is created for them
  it('returns null when profile row is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'no rows' } })
    expect(await getUserRole()).toBeNull()
  })

  // Tests: getUserRole returns 'contributor' when the user's profile has role='contributor'
  // How:   mockSingle returns { data: { role: 'contributor' } }; checks result is 'contributor'
  // Chain: the layout passes the role to the Nav component and server component page guards →
  //        contributors see the dashboard link and can access the upload wizard and their tutorials
  it('returns contributor for a contributor user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({ data: { role: 'contributor' } })
    expect(await getUserRole()).toBe('contributor')
  })

  // Tests: getUserRole returns 'admin' when the user's profile has role='admin'
  // How:   mockSingle returns { data: { role: 'admin' } }; checks result is 'admin'
  // Chain: the layout passes 'admin' to Nav and page guards → admin users see the Admin link
  //        and can access the pending tutorials review and contributor management pages
  it('returns admin for an admin user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({ data: { role: 'admin' } })
    expect(await getUserRole()).toBe('admin')
  })

  // Tests: getUserRole returns null when the profile role column holds an unrecognised value
  // How:   mockSingle returns { data: { role: 'wizard' } }; checks result is null
  // Chain: preserves the defensive intent behind the original narrowing — an unexpected
  //        value in the role column must not slip through and look like a valid login
  it('returns null for an unrecognised role', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({ data: { role: 'wizard' } })
    expect(await getUserRole()).toBeNull()
  })

  // Tests: getUserRole returns null (instead of throwing) if the Supabase call itself throws
  // How:   mockGetUser rejects with new Error('Supabase unavailable'); checks result is null
  // Chain: a Supabase outage causes all server components to treat the user as unauthenticated
  //        rather than crashing the entire page render with an uncaught promise rejection
  it('returns null when Supabase throws', async () => {
    mockGetUser.mockRejectedValue(new Error('Supabase unavailable'))
    expect(await getUserRole()).toBeNull()
  })
})
