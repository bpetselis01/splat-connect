import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ProfileTabPage from '@/app/dashboard/profile/page'
import type { ChildProfile } from '@splat-connect/types'

vi.mock('@/lib/capabilities', () => ({
  getCapabilities: async () => ({
    profile: { id: 'u1', name: 'Lee', email: 'lee@example.com', role: 'contributor', created_at: '', public_showcase: true },
    isAdmin: false,
    ledOrgs: [],
    exchangeActions: 0,
  }),
}))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn() } }))
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

import { apiClient } from '@/lib/api-client'

const child = (over: Partial<ChildProfile>): ChildProfile => ({
  id: 'c1',
  parent_id: 'u1',
  name: null,
  age: null,
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

describe('ProfileTabPage', () => {
  beforeEach(() => vi.resetAllMocks())

  it('renders the profile form alongside the child profiles section', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([])
    render(await ProfileTabPage())
    expect(screen.getByLabelText('Full name')).toHaveValue('Lee')
    expect(screen.getByRole('heading', { name: 'Child profiles' })).toBeInTheDocument()
  })

  // Chain: a brand-new account has to learn why this section exists before it
  //        has anything to show.
  it('explains the section and offers Add child when there are none', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([])
    render(await ProfileTabPage())
    expect(screen.getByText(/helps us suggest tutorials/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /add child/i })).toHaveAttribute('href', '/dashboard/child/new')
  })

  it('shows the empty-state icon and message when there are no children', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([])
    render(await ProfileTabPage())
    expect(screen.getByText("You haven't added any child profiles yet.")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /add your first child/i })).toHaveAttribute(
      'href',
      '/dashboard/child/new'
    )
  })

  it('renders one row per child, each linking to its edit page', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([
      child({ id: 'c1', name: 'Emma' }),
      child({ id: 'c2', name: null }),
    ])
    render(await ProfileTabPage())
    expect(screen.getByRole('link', { name: /Emma/ })).toHaveAttribute('href', '/dashboard/child/c1')
    expect(screen.getByRole('link', { name: /Child 2/ })).toHaveAttribute('href', '/dashboard/child/c2')
  })

  // Chain: swallowing a failed fetch into an empty list would tell a parent
  //        their children are gone. The page must fail loudly instead.
  it('throws rather than rendering an empty list when the fetch fails', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('network'))
    await expect(ProfileTabPage()).rejects.toThrow('network')
  })
})
