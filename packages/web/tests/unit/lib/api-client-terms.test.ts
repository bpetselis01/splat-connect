import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
const pathSearch = vi.hoisted(() => ({ current: '/dashboard/exchanges/abc?tab=open' as string | null }))
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve({ getAll: () => [] })),
  headers: async () => ({ get: (k: string) => (k === 'x-pathname-search' ? pathSearch.current : null) }),
}))
const redirect = vi.hoisted(() =>
  vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`)
  })
)
vi.mock('next/navigation', () => ({ redirect }))
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getSession: vi.fn(() => Promise.resolve({ data: { session: { access_token: 'mock-token' } } })) },
  })),
}))

const fetchMock = vi.fn()
global.fetch = fetchMock
const { apiClient } = await import('@/lib/api-client')
const refused = (body: Record<string, string>) => ({ ok: false, status: 403, clone: () => ({ json: async () => body }) })

beforeEach(() => {
  vi.clearAllMocks()
  process.env.API_URL = 'http://localhost:3101'
})

describe('server apiClient on terms_required', () => {
  it('redirects to the terms page, returning to the page the action was posted from', async () => {
    fetchMock.mockResolvedValue(refused({ error: 'terms_required' }))
    await expect(apiClient.post('/api/toy-transactions/abc/messages', { body: 'hi' })).rejects.toThrow(
      'NEXT_REDIRECT /onboarding/contributor-terms?next=%2Fdashboard%2Fexchanges%2Fabc%3Ftab%3Dopen'
    )
    expect(redirect).toHaveBeenCalledTimes(1)
  })

  it('leaves a plain 403 alone', async () => {
    fetchMock.mockResolvedValue(refused({ error: 'Forbidden' }))
    await expect(apiClient.post('/api/x', {})).rejects.toThrow('Forbidden')
    expect(redirect).not.toHaveBeenCalled()
  })
})
