import { AGREEMENT_VERSIONS } from '@splat-connect/types'
import { describe, it, expect, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'

const post = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post } }))

vi.mock('@/lib/capabilities', () => ({
  getCapabilities: async () => ({
    profile: { id: 'u1', name: 'Lee', email: 'lee@example.com', role: 'contributor' },
    isAdmin: false,
    ledOrgs: [{ id: 'oA', name: 'Splat North', status: 'active' }],
  }),
}))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: async (path: string) =>
      path === '/api/agreements/me'
        ? [{ agreement_type: 'org_leader_terms', version: AGREEMENT_VERSIONS.org_leader_terms }]
        : [],
  },
}))

const Page = (await import('@/app/dashboard/organisation/page')).default

describe('Organisation hub', () => {
  it('posts the organisations bucket read once when a leader opens it', async () => {
    render(await Page())
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    expect(post).toHaveBeenCalledWith('/api/notifications/me/read', { bucket: 'organisations' })
  })
})
