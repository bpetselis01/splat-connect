import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import EditChildPage from '@/app/dashboard/child/[id]/page'
import type { ChildProfile } from '@splat-connect/types'

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
  usePathname: () => '/dashboard/child/c1',
  useSearchParams: () => new URLSearchParams(''),
}))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))

import { apiClient } from '@/lib/api-client'

const child = (over: Partial<ChildProfile>): ChildProfile => ({
  id: 'c1',
  parent_id: 'u1',
  name: null,
  age: null,
  primary_diagnosis: null,
  macs_level: null,
  macs_source: 'manual',
  hand_involvement: null,
  assist_hand: null,
  bfmf_score: null,
  bfmf_source: 'manual',
  challenges: [],
  challenge_other: null,
  grip_type: null,
  env_context: null,
  palm_width_mm: null,
  wrist_circ_mm: null,
  needs_arm_attachment: false,
  forearm_length_mm: null,
  hand_dominance: null,
  sensory_preferences: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
})

describe('EditChildPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('seeds the Ability panel from the requested child', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([child({ id: 'c1', name: 'Emma', age: 7 })])
    render(await EditChildPage({ params: Promise.resolve({ id: 'c1' }) }))
    fireEvent.click(screen.getByRole('tab', { name: /ability/i }))
    expect(screen.getByLabelText('Name (optional)')).toHaveValue('Emma')
    expect(screen.getByLabelText('Age')).toHaveValue(7)
  })

  // Chain: the heading has to agree with the list, and the list numbers unnamed
  //        children by position.
  it('heads an unnamed child with its position, matching the list', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([child({ id: 'c1' }), child({ id: 'c2' })])
    render(await EditChildPage({ params: Promise.resolve({ id: 'c2' }) }))
    expect(screen.getByRole('heading', { name: 'Child 2' })).toBeInTheDocument()
  })

  it('404s on a child that is not the caller\'s', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([child({ id: 'c1' })])
    await expect(EditChildPage({ params: Promise.resolve({ id: 'someone-elses' }) })).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
