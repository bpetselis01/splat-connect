import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
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
    working_hand: null,
    press_force: null,
    aim: null,
    hold: null,
    everyday_needs: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

const NEW_FIELDS = ['name', 'age', 'working_hand', 'press_force', 'aim', 'hold', 'everyday_needs']

describe('ChildEditor', () => {
  beforeEach(() => {
    replace.mockClear()
    vi.mocked(browserApiClient.post).mockReset()
    vi.mocked(browserApiClient.patch).mockReset()
  })

  it('heads a blank slate "Add a child" when there is no name or label', () => {
    render(<ChildEditor child={null} />)
    expect(screen.getByRole('heading', { name: 'Add a child' })).toBeInTheDocument()
  })

  it('falls back to the passed-in label when the child has no name', () => {
    render(<ChildEditor child={child()} label="Child 2" />)
    expect(screen.getByRole('heading', { name: 'Child 2' })).toBeInTheDocument()
  })

  it("prefers the child's own name over the passed-in label", () => {
    render(<ChildEditor child={child({ name: 'Emma' })} label="Child 2" />)
    expect(screen.getByRole('heading', { name: 'Emma' })).toBeInTheDocument()
  })

  it('says the profile is private and optional, and is not a medical device', () => {
    render(<ChildEditor child={null} />)
    expect(screen.getByText('Private to you')).toBeInTheDocument()
    expect(screen.getByText(/Every field is optional/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'privacy policy' })).toHaveAttribute('href', '/privacy')
    expect(screen.getByText(/not a medical/)).toBeInTheDocument()
  })

  it("draws the board's three cards and asks none of the retired questions", () => {
    render(<ChildEditor child={null} />)
    for (const name of ['Basics', 'Ability profile', 'Everyday needs']) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument()
    }
    expect(screen.queryByRole('region', { name: 'Customization' })).not.toBeInTheDocument()
    expect(screen.queryByText(/MACS|BFMF|Grip type|Palm width|Sensory/)).not.toBeInTheDocument()
    for (const q of ['Which hand does most of the work?', 'How much force can they apply?', 'Can they aim at a target?', 'How long can they hold a press?']) {
      expect(screen.getByRole('group', { name: q })).toBeInTheDocument()
    }
    // One save for the whole page.
    expect(screen.getAllByRole('button', { name: /save|create/i })).toHaveLength(1)
  })

  it('toggles a single-choice chip on, across, and off again', () => {
    render(<ChildEditor child={null} />)
    const hand = within(screen.getByRole('group', { name: 'Which hand does most of the work?' }))
    fireEvent.click(hand.getByRole('button', { name: 'Left' }))
    expect(hand.getByRole('button', { name: 'Left' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(hand.getByRole('button', { name: 'Right' }))
    expect(hand.getByRole('button', { name: 'Left' })).toHaveAttribute('aria-pressed', 'false')
    expect(hand.getByRole('button', { name: 'Right' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(hand.getByRole('button', { name: 'Right' }))
    expect(hand.getByRole('button', { name: 'Right' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('creates the profile with only the board fields and swaps the URL to its id', async () => {
    vi.mocked(browserApiClient.post).mockResolvedValue(child({ id: 'new-id', name: 'Emma' }))
    render(<ChildEditor child={null} />)

    fireEvent.change(screen.getByLabelText('Name or nickname'), { target: { value: ' Emma ' } })
    fireEvent.change(screen.getByLabelText('Age'), { target: { value: '6' } })
    fireEvent.click(screen.getByRole('button', { name: 'Light' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, large' }))
    fireEvent.click(screen.getByRole('button', { name: 'Quiet toys only' }))
    fireEvent.click(screen.getByRole('button', { name: 'Wipeable' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create profile' }))

    await screen.findByText('Saved')
    const [path, body] = vi.mocked(browserApiClient.post).mock.calls[0]
    expect(path).toBe('/api/child-profiles')
    expect(Object.keys(body as object).sort()).toEqual([...NEW_FIELDS].sort())
    expect(body).toEqual({
      name: 'Emma', age: 6, working_hand: null, press_force: 'light', aim: 'large', hold: null,
      everyday_needs: ['quiet', 'wipeable'],
    })
    expect(replace).toHaveBeenCalledWith('/dashboard/child/new-id')
  })

  it('PATCHes an existing child from its stored answers, unticking a need', async () => {
    vi.mocked(browserApiClient.patch).mockResolvedValue(child({ name: 'Emma' }))
    render(<ChildEditor child={child({ id: 'c1', name: 'Emma', working_hand: 'left', everyday_needs: ['quiet', 'wipeable'] })} />)

    expect(screen.getByRole('button', { name: 'Left' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Quiet toys only' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await screen.findByText('Saved')
    expect(browserApiClient.patch).toHaveBeenCalledWith(
      '/api/child-profiles/c1',
      expect.objectContaining({ name: 'Emma', working_hand: 'left', everyday_needs: ['wipeable'] })
    )
  })

  it('saves a blank form as all-empty: skipping every question is allowed', async () => {
    vi.mocked(browserApiClient.post).mockResolvedValue(child({ id: 'blank' }))
    render(<ChildEditor child={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Create profile' }))
    await screen.findByText('Saved')
    expect(browserApiClient.post).toHaveBeenCalledWith('/api/child-profiles', {
      name: null, age: null, working_hand: null, press_force: null, aim: null, hold: null, everyday_needs: [],
    })
  })

  it('shows the error and no Saved when the save fails', async () => {
    vi.mocked(browserApiClient.post).mockRejectedValue(new Error('nope'))
    render(<ChildEditor child={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Create profile' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('nope')
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })

  it('shows no delete button before the profile is first saved', () => {
    render(<ChildEditor child={null} />)
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
  })

  it('shows a delete button scoped to this child once it exists', () => {
    render(<ChildEditor child={child({ id: 'c1' })} label="Child 1" />)
    expect(screen.getByRole('button', { name: 'Delete Child 1' })).toBeInTheDocument()
  })
})
