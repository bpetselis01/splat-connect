import { AGREEMENT_VERSIONS } from '@splat-connect/types'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const agreements = vi.hoisted(() => ({ current: [] as unknown[] }))

vi.mock('@/lib/capabilities', () => ({
  getCapabilities: async () => ({
    profile: { id: 'u1', name: 'Lee', email: 'lee@example.com', role: 'contributor' },
    isAdmin: false,
    ledOrgs: [{ id: 'oA', name: 'Splat North', status: 'active' }],
  }),
}))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }), notFound: vi.fn() }))
vi.mock('@/lib/api-client', () => ({
  apiClient: { get: async (path: string) => (path === '/api/agreements/me' ? agreements.current : []) },
}))
vi.mock('@/components/terms-gate', () => ({ TermsGate: () => <p>terms gate</p> }))

const Page = (await import('@/app/dashboard/organisation/page')).default

describe('Organisation tab — leader terms', () => {
  it('WB03 asks for the leader terms when none are accepted, and opens the gate on "Read and accept"', async () => {
    agreements.current = []
    render(await Page())
    expect(
      screen.getByText('You have not accepted the leader terms. You can read the queue, but not approve anything.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Leader terms accepted')).not.toBeInTheDocument()
    expect(screen.queryByText('terms gate')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Read and accept' }))
    expect(screen.getByText('terms gate')).toBeInTheDocument()
  })

  it('WB03 shows "Leader terms accepted" and no strip once the current version is accepted', async () => {
    agreements.current = [{ agreement_type: 'org_leader_terms', version: AGREEMENT_VERSIONS.org_leader_terms }]
    render(await Page())
    expect(screen.getByText('Leader terms accepted')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Read and accept' })).not.toBeInTheDocument()
  })
})
