import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChildEditor } from '@/components/child-editor'
import type { ChildProfile } from '@splat-connect/types'

const replace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/dashboard/child/new',
  useSearchParams: () => new URLSearchParams(''),
}))

vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import { browserApiClient } from '@/lib/browser-api-client'

function child(overrides: Partial<ChildProfile> = {}): ChildProfile {
  return {
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
    ...overrides,
  }
}

describe('ChildEditor', () => {
  beforeEach(() => {
    replace.mockClear()
    vi.mocked(browserApiClient.post).mockReset()
    vi.mocked(browserApiClient.patch).mockReset()
  })

  it('heads a blank slate "Add child" when there is no name or label', () => {
    render(<ChildEditor child={null} />)
    expect(screen.getByRole('heading', { name: 'Add child' })).toBeInTheDocument()
  })

  it('falls back to the passed-in label when the child has no name', () => {
    render(<ChildEditor child={child()} label="Child 2" />)
    expect(screen.getByRole('heading', { name: 'Child 2' })).toBeInTheDocument()
  })

  it("prefers the child's own name over the passed-in label", () => {
    render(<ChildEditor child={child({ name: 'Emma' })} label="Child 2" />)
    expect(screen.getByRole('heading', { name: 'Emma' })).toBeInTheDocument()
  })

  it('creates the profile from whichever pill is saved first and swaps the URL to its id', async () => {
    vi.mocked(browserApiClient.post).mockResolvedValue(child({ id: 'new-id', name: 'Emma' }))
    render(<ChildEditor child={null} />)

    fireEvent.click(screen.getByRole('tab', { name: /ability/i }))
    fireEvent.change(screen.getByLabelText('Name (optional)'), { target: { value: 'Emma' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByText('Saved')
    expect(browserApiClient.post).toHaveBeenCalledWith(
      '/api/child-profiles',
      expect.objectContaining({ name: 'Emma' })
    )
    expect(replace).toHaveBeenCalledWith('/dashboard/child/new-id')
  })

  it('PATCHes subsequent saves once the profile already exists', async () => {
    vi.mocked(browserApiClient.patch).mockResolvedValue(child({ name: 'Emma 2' }))
    render(<ChildEditor child={child({ id: 'c1' })} />)

    fireEvent.click(screen.getByRole('tab', { name: /ability/i }))
    fireEvent.change(screen.getByLabelText('Name (optional)'), { target: { value: 'Emma 2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByText('Saved')
    expect(browserApiClient.patch).toHaveBeenCalledWith(
      '/api/child-profiles/c1',
      expect.objectContaining({ name: 'Emma 2' })
    )
  })

  it('shows no delete pill before the profile is first saved', () => {
    render(<ChildEditor child={null} />)
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
  })

  it('shows a delete pill scoped to this child once it exists', () => {
    render(<ChildEditor child={child({ id: 'c1' })} label="Child 1" />)
    expect(screen.getByRole('button', { name: 'Delete Child 1' })).toBeInTheDocument()
  })
})
