import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { ChildEditor } from '@/components/child-editor'
import type { ChildProfile } from '@splat-connect/types'

const replace = vi.fn()
const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push, refresh: vi.fn() }),
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
    enjoys: [],
    reach_cm: null,
    tray_mm: null,
    wrist_circ_mm: null,
    needs_arm_attachment: false,
    forearm_length_mm: null,
    hand_dominance: null,
    sensory_preferences: [],
    helps_with: [],
    access: [],
    one_hand: false,
    press_force: null,
    everyday_needs: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

const NEW_FIELDS = [
  'age', 'helps_with', 'access', 'one_hand', 'press_force', 'enjoys', 'everyday_needs',
  'palm_width_mm', 'reach_cm', 'tray_mm',
]

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

  it('heads the page with the passed-in label', () => {
    render(<ChildEditor child={child()} label="Child 2" />)
    expect(screen.getByRole('heading', { name: 'Child 2' })).toBeInTheDocument()
  })

  it('asks for no name', () => {
    render(<ChildEditor child={child()} label="Child 2" />)
    expect(screen.queryByLabelText(/name/i)).not.toBeInTheDocument()
  })

  it('says the profile is private and optional, and is not a medical device', () => {
    render(<ChildEditor child={null} />)
    expect(screen.getByText('Private to you')).toBeInTheDocument()
    expect(screen.getByText(/Every field is optional/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'privacy policy' })).toHaveAttribute('href', '/privacy')
    expect(screen.getByText(/not a medical/)).toBeInTheDocument()
  })

  it("draws the cards and asks the four child questions, none of the retired ones", () => {
    render(<ChildEditor child={null} />)
    for (const name of ['Basics', 'Who they are', 'Good to know', 'Measurements']) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument()
    }
    expect(screen.queryByRole('region', { name: 'Play' })).not.toBeInTheDocument()
    expect(screen.queryByText(/MACS|BFMF|Grip type|Palm width|Sensory/)).not.toBeInTheDocument()
    // Each question is a fieldset, with the chips grouped inside it.
    for (const q of ['Helps with', 'How the child uses it', 'Press force', 'Play']) {
      expect(screen.getAllByRole('group', { name: q }).length).toBeGreaterThan(0)
    }
    expect(screen.queryByText('Which hand does most of the work?')).not.toBeInTheDocument()
    // One save for the whole page.
    expect(screen.getAllByRole('button', { name: /save|create/i })).toHaveLength(1)
  })

  it('toggles a single-choice chip on, across, and off again', () => {
    render(<ChildEditor child={null} />)
    const force = within(screen.getByRole('group', { name: 'Press force' }))
    fireEvent.click(force.getByRole('button', { name: 'Light' }))
    expect(force.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(force.getByRole('button', { name: 'Full' }))
    expect(force.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'false')
    expect(force.getByRole('button', { name: 'Full' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(force.getByRole('button', { name: 'Full' }))
    expect(force.getByRole('button', { name: 'Full' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('WD15 creates the profile with only the form fields and swaps the URL to its id', async () => {
    vi.mocked(browserApiClient.post).mockResolvedValue(child({ id: 'new-id' }))
    render(<ChildEditor child={null} />)

    fireEvent.change(screen.getByLabelText('Age'), { target: { value: '6' } })
    fireEvent.click(screen.getByRole('button', { name: 'Seeing' }))
    fireEvent.click(screen.getByRole('button', { name: 'Feeling calm' }))
    fireEvent.click(screen.getByRole('button', { name: 'Light touch' }))
    // The One hand chip sits with How they use it but is its own boolean.
    fireEvent.click(screen.getByRole('button', { name: 'One hand is enough' }))
    fireEvent.click(screen.getByRole('button', { name: 'Light' }))
    fireEvent.click(screen.getByRole('button', { name: 'Quiet toys only' }))
    fireEvent.click(screen.getByRole('button', { name: 'Wipeable' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create profile' }))

    await screen.findByText('Saved')
    const [path, body] = vi.mocked(browserApiClient.post).mock.calls[0]
    expect(path).toBe('/api/child-profiles')
    expect(Object.keys(body as object).sort()).toEqual([...NEW_FIELDS].sort())
    expect(body).toEqual({
      age: 6, helps_with: ['seeing', 'calm'], access: ['touch'], one_hand: true, press_force: 'light',
      enjoys: [], everyday_needs: ['quiet', 'wipeable'],
      palm_width_mm: null, reach_cm: null, tray_mm: null,
    })
    expect(replace).toHaveBeenCalledWith('/dashboard/child/new-id')
  })

  it('WD16 PATCHes an existing child from its stored answers, unticking a need', async () => {
    vi.mocked(browserApiClient.patch).mockResolvedValue(child())
    render(<ChildEditor child={child({ id: 'c1', helps_with: ['seeing'], one_hand: true, everyday_needs: ['quiet', 'wipeable'] })} />)

    expect(screen.getByRole('button', { name: 'Seeing' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'One hand is enough' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Quiet toys only' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await screen.findByText('Saved')
    expect(browserApiClient.patch).toHaveBeenCalledWith(
      '/api/child-profiles/c1',
      expect.objectContaining({ helps_with: ['seeing'], one_hand: true, everyday_needs: ['wipeable'] })
    )
  })

  it('saves a blank form as all-empty: skipping every question is allowed', async () => {
    vi.mocked(browserApiClient.post).mockResolvedValue(child({ id: 'blank' }))
    render(<ChildEditor child={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Create profile' }))
    await screen.findByText('Saved')
    expect(browserApiClient.post).toHaveBeenCalledWith('/api/child-profiles', {
      age: null, helps_with: [], access: [], one_hand: false, press_force: null, enjoys: [], everyday_needs: [],
      palm_width_mm: null, reach_cm: null, tray_mm: null,
    })
  })

  // Play is a question in "Who they are"; the three measurements are editable here too.
  it('shows and edits what the child enjoys and their measurements', async () => {
    vi.mocked(browserApiClient.patch).mockResolvedValue(child())
    render(<ChildEditor child={child({ id: 'c1', enjoys: ['water'], palm_width_mm: 62, tray_mm: 15 })} />)
    const play = within(screen.getAllByRole('group', { name: 'Play' })[0])
    expect(play.getByRole('button', { name: 'Bubbles and water' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Hand width (mm)')).toHaveValue(62)

    fireEvent.click(play.getByRole('button', { name: 'Lights' }))
    fireEvent.change(screen.getByLabelText('Reach from seated (cm)'), { target: { value: '30' } })
    fireEvent.change(screen.getByLabelText('Tray thickness (mm)'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await screen.findByText('Saved')
    expect(browserApiClient.patch).toHaveBeenCalledWith(
      '/api/child-profiles/c1',
      expect.objectContaining({ enjoys: ['water', 'light'], palm_width_mm: 62, reach_cm: 30, tray_mm: null })
    )
  })

  it('accepts a decimal measurement, which readMeasure and the table both allow', async () => {
    vi.mocked(browserApiClient.patch).mockResolvedValue(child())
    render(<ChildEditor child={child({ id: 'c1' })} />)
    const input = screen.getByLabelText('Hand width (mm)')
    expect(input).toHaveAttribute('step', 'any')
    fireEvent.change(input, { target: { value: '62.5' } })
    expect(input).toBeValid()
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findByText('Saved')
    expect(browserApiClient.patch).toHaveBeenCalledWith('/api/child-profiles/c1', expect.objectContaining({ palm_width_mm: 62.5 }))
  })

  it('says the range of a measurement out of it and does not save', () => {
    render(<ChildEditor child={child({ id: 'c1' })} />)
    fireEvent.change(screen.getByLabelText('Hand width (mm)'), { target: { value: '10' } })
    expect(screen.getByText('Between 20 and 250.')).toBeInTheDocument()
    expect(screen.getByLabelText('Hand width (mm)')).toBeInvalid()
    // The browser's own range check holds the submit.
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(browserApiClient.patch).not.toHaveBeenCalled()
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

  it('WD17 deletes the child after the confirm phrase and goes back to Account', async () => {
    vi.mocked(browserApiClient.delete).mockResolvedValue(null)
    render(<ChildEditor child={child({ id: 'c1' })} label="Child 1, age 6" />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete Child 1, age 6' }))
    fireEvent.change(screen.getByLabelText(/to confirm/i), { target: { value: 'confirm_delete_Child_1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard/profile'))
    expect(browserApiClient.delete).toHaveBeenCalledWith('/api/child-profiles/c1')
  })
})
