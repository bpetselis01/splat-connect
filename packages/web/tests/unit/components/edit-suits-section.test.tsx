import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditSuitsSection } from '@/components/edit-suits-section'

vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { get: vi.fn(), patch: vi.fn() },
}))
import { browserApiClient } from '@/lib/browser-api-client'

const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save who it suits' }))
const range = (label: string, from: string, to: string) => {
  fireEvent.change(screen.getByLabelText(`${label} from`), { target: { value: from } })
  fireEvent.change(screen.getByLabelText(`${label} to`), { target: { value: to } })
}

describe('EditSuitsSection', () => {
  beforeEach(() => {
    vi.mocked(browserApiClient.get).mockReset()
    vi.mocked(browserApiClient.patch).mockReset().mockResolvedValue({})
  })

  it('renders the three groups and three ranges, seeded from the item', () => {
    render(<EditSuitsSection endpoint="/api/toys/t1" suits={{ movement: ['press'], fit: { reach_cm: [20, 40] } }} />)
    expect(screen.getByRole('group', { name: 'Movement' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Hands' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Play' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Palm or fist press' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Lever' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByLabelText('Reach from seated (cm) from')).toHaveValue(20)
    expect(screen.getByText(/None of these are required/)).toBeInTheDocument()
  })

  it('toggles chips and sends lists, with null for empty ones and for no ranges', async () => {
    render(<EditSuitsSection endpoint="/api/toys/t1" suits={{ hands: ['both'] }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Lever' }))
    expect(screen.getByRole('button', { name: 'Lever' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Both hands' }))
    save()
    await waitFor(() =>
      expect(browserApiClient.patch).toHaveBeenCalledWith('/api/toys/t1', { movement: ['lever'], hands: null, play: null, fit: null })
    )
  })

  it('sends only the filled ranges', async () => {
    render(<EditSuitsSection endpoint="/api/toys/t1" suits={{}} />)
    range('Hand width (mm)', '50', '70')
    save()
    await waitFor(() =>
      expect(browserApiClient.patch).toHaveBeenCalledWith('/api/toys/t1', expect.objectContaining({ fit: { palm_width_mm: [50, 70] } }))
    )
  })

  it('reads updated_at first for a guide and sends it', async () => {
    vi.mocked(browserApiClient.get).mockResolvedValue({ updated_at: 'T1' })
    render(<EditSuitsSection endpoint="/api/tutorials/g1" lock suits={{}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Lights' }))
    save()
    await waitFor(() =>
      expect(browserApiClient.patch).toHaveBeenCalledWith('/api/tutorials/g1', { movement: null, hands: null, play: ['light'], fit: null, updated_at: 'T1' })
    )
  })

  it('refuses an out-of-range or backwards range locally, without saving', () => {
    render(<EditSuitsSection endpoint="/api/toys/t1" suits={{}} />)
    range('Hand width (mm)', '70', '50')
    save()
    expect(screen.getByRole('alert')).toHaveTextContent(/Hand width \(mm\): a range from 20 to 250/)
    range('Hand width (mm)', '5', '50')
    save()
    expect(screen.getByRole('alert')).toHaveTextContent(/a range from 20 to 250/)
    expect(browserApiClient.patch).not.toHaveBeenCalled()
  })

  it('asks for both ends of a half-filled range', () => {
    render(<EditSuitsSection endpoint="/api/toys/t1" suits={{}} />)
    fireEvent.change(screen.getByLabelText('Tray thickness (mm) from'), { target: { value: '5' } })
    save()
    expect(screen.getByRole('alert')).toHaveTextContent(/both ends/)
    expect(browserApiClient.patch).not.toHaveBeenCalled()
  })

  it("shows the API's sentence when it refuses", async () => {
    vi.mocked(browserApiClient.patch).mockRejectedValue(new Error('PATCH /api/toys/t1 failed with status 400: hands must be a list.'))
    render(<EditSuitsSection endpoint="/api/toys/t1" suits={{}} />)
    save()
    expect(await screen.findByRole('alert')).toHaveTextContent('hands must be a list.')
  })

  it('reports the saved item to the parent', async () => {
    const onSaved = vi.fn()
    vi.mocked(browserApiClient.patch).mockResolvedValue({ movement: ['grasp'] })
    render(<EditSuitsSection endpoint="/api/toys/t1" suits={{}} onSaved={onSaved} />)
    save()
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ movement: ['grasp'] }))
    expect(screen.getByRole('status')).toHaveTextContent('Saved')
  })
})
