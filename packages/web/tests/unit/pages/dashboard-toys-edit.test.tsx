import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ToyEditPage from '@/app/dashboard/toys/[id]/page'
import type { Toy } from '@splat-connect/types'

vi.mock('@/lib/capabilities', () => ({
  getCapabilities: async () => ({
    profile: { id: 'u1', name: 'Lee', email: 'lee@example.com', role: 'contributor' },
    isAdmin: false,
    ledOrgs: [],
  }),
}))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn() } }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/dashboard/toys/t1',
  useSearchParams: () => new URLSearchParams(''),
}))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))

import { apiClient } from '@/lib/api-client'

function toy(overrides: Partial<Toy> = {}): Toy {
  return {
    id: 't1',
    owner_id: 'u1',
    owner_org_id: null,
    quantity: 1,
    name: 'Fire truck',
    description: null,
    condition: 8,
    switch_adapted: false,
    cover_photo_url: 'https://example.com/cover.jpg',
    switch_photo_urls: [],
    status: 'draft',
    created_at: '',
    updated_at: '',
    offer_type: null,
    ...overrides,
  }
}

describe('ToyEditPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('seeds the editor from the requested toy', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([toy({ id: 't1', name: 'Fire truck' })])
    render(await ToyEditPage({ params: Promise.resolve({ id: 't1' }) }))
    expect(screen.getByRole('heading', { name: 'Fire truck' })).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Fire truck')
  })

  it("404s on a toy that is not the caller's", async () => {
    vi.mocked(apiClient.get).mockResolvedValue([toy({ id: 't1' })])
    await expect(ToyEditPage({ params: Promise.resolve({ id: 'someone-elses' }) })).rejects.toThrow('NEXT_NOT_FOUND')
  })

})
