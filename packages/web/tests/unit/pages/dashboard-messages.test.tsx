import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import OrgConversationPage from '@/app/dashboard/messages/[cid]/page'
import type { OrgThread } from '@splat-connect/types'

const caps = vi.hoisted(() => ({ id: 'fam' }))
vi.mock('@/lib/capabilities', () => ({
  getCapabilities: async () => ({
    profile: { id: caps.id, name: 'Priya', email: 'p@example.com', role: 'contributor', created_at: '', public_showcase: true },
    isAdmin: false,
    ledOrgs: [],
    exchangeActions: 0,
  }),
}))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn() } }))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
  redirect: vi.fn(),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => '/dashboard/messages/c1',
}))
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: vi.fn() } }))

import { apiClient } from '@/lib/api-client'

const thread = {
  conversation: { id: 'c1', org_id: 'o1', profile_id: 'fam', created_at: '', updated_at: '' },
  org_name: 'Northbank',
  person_name: 'Priya',
  messages: [],
} as unknown as OrgThread

beforeEach(() => {
  vi.clearAllMocks()
  caps.id = 'fam'
})

describe('OrgConversationPage', () => {
  it('WD36 heads the family’s thread with the organisation name and offers no back link', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(thread)
    render(await OrgConversationPage({ params: Promise.resolve({ cid: 'c1' }) }))
    expect(apiClient.get).toHaveBeenCalledWith('/api/organizations/conversations/c1')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Northbank')
    expect(screen.queryByRole('link', { name: /Messages/ })).toBeNull()
  })

  it('WD36 heads the leader’s thread with the family and links back to Messages', async () => {
    caps.id = 'leader'
    vi.mocked(apiClient.get).mockResolvedValue(thread)
    render(await OrgConversationPage({ params: Promise.resolve({ cid: 'c1' }) }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Priya, writing to Northbank')
    expect(screen.getByRole('link', { name: /Messages/ })).toHaveAttribute('href', '/dashboard/organisation/messages')
  })

  it('WD36 is a 404 for a conversation the API says is not yours, and rethrows any other failure', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('API request failed with status 404'))
    await expect(OrgConversationPage({ params: Promise.resolve({ cid: 'c1' }) })).rejects.toThrow('NEXT_NOT_FOUND')
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('API request failed with status 500'))
    await expect(OrgConversationPage({ params: Promise.resolve({ cid: 'c1' }) })).rejects.toThrow('status 500')
  })
})
