import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditSuitsSection } from '@/components/edit-suits-section'

vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { get: vi.fn(), patch: vi.fn() },
}))
import { browserApiClient } from '@/lib/browser-api-client'

const save = () => fireEvent.click(screen.getByRole('button', { name: "Save who it's for" }))

describe('EditSuitsSection', () => {
  beforeEach(() => {
    vi.mocked(browserApiClient.get).mockReset()
    vi.mocked(browserApiClient.patch).mockReset().mockResolvedValue({})
  })

  it('renders the toy groups, seeded from the item, with no device type', () => {
    render(<EditSuitsSection endpoint="/api/toys/t1" suits={{ helps_with: ['seeing'], one_hand: true }} />)
    for (const name of ['Helps with', 'How a child uses it', 'Press force it works with', 'Play']) {
      expect(screen.getByRole('group', { name })).toBeInTheDocument()
    }
    expect(screen.queryByRole('group', { name: 'What is it?' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Seeing' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'One hand is enough' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Hearing' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText(/None of these are required/)).toBeInTheDocument()
  })

  it('WY18 toggles chips and sends lists, with null for empty ones and one_hand as a boolean', async () => {
    render(<EditSuitsSection endpoint="/api/toys/t1" suits={{ helps_with: ['seeing'] }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Light touch' }))
    expect(screen.getByRole('button', { name: 'Light touch' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'One hand is enough' }))
    fireEvent.click(screen.getByRole('button', { name: 'Seeing' }))
    save()
    await waitFor(() =>
      expect(browserApiClient.patch).toHaveBeenCalledWith('/api/toys/t1', {
        helps_with: null, access: ['touch'], one_hand: true, press_force: null, play: null,
      })
    )
  })

  it('sends device types only for a guide', async () => {
    render(<EditSuitsSection endpoint="/api/tutorials/g1" guide suits={{ device_types: ['switch'] }} />)
    expect(screen.getByRole('button', { name: 'Switch' })).toHaveAttribute('aria-pressed', 'true')
    save()
    await waitFor(() =>
      expect(browserApiClient.patch).toHaveBeenCalledWith('/api/tutorials/g1', expect.objectContaining({ device_types: ['switch'], one_hand: false }))
    )
  })

  it('WT20 reads updated_at first for a guide and sends it', async () => {
    vi.mocked(browserApiClient.get).mockResolvedValue({ updated_at: 'T1' })
    render(<EditSuitsSection endpoint="/api/tutorials/g1" guide lock suits={{}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Lights' }))
    save()
    await waitFor(() =>
      expect(browserApiClient.patch).toHaveBeenCalledWith('/api/tutorials/g1', {
        device_types: null, helps_with: null, access: null, one_hand: false, press_force: null, play: ['light'], updated_at: 'T1',
      })
    )
  })

  it("shows the API's sentence when it refuses", async () => {
    vi.mocked(browserApiClient.patch).mockRejectedValue(new Error('PATCH /api/toys/t1 failed with status 400: access must be a list.'))
    render(<EditSuitsSection endpoint="/api/toys/t1" suits={{}} />)
    save()
    expect(await screen.findByRole('alert')).toHaveTextContent('access must be a list.')
  })

  it('reports the saved item to the parent', async () => {
    const onSaved = vi.fn()
    vi.mocked(browserApiClient.patch).mockResolvedValue({ access: ['grasp'] })
    render(<EditSuitsSection endpoint="/api/toys/t1" suits={{}} onSaved={onSaved} />)
    save()
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ access: ['grasp'] }))
    expect(screen.getByRole('status')).toHaveTextContent('Saved')
  })
})
