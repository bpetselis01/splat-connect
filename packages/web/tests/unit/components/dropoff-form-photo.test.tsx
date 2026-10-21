import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DECLARATION_VERSION, RECYCLING_DECLARATION } from '@splat-connect/types'
import { DropoffForm } from '@/components/dropoff-form'
import { browserApiClient } from '@/lib/browser-api-client'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: vi.fn(), postFormData: vi.fn() } }))

const ORG = { id: 'north', name: 'Northside', suburb: null, state: null, recycling_materials: ['PLA'], recycling_note: null }

describe('DropoffForm photo', () => {
  beforeEach(() => vi.clearAllMocks())

  it('WI37 uploads the photo and books with its path', async () => {
    vi.mocked(browserApiClient.postFormData).mockResolvedValue({ path: 'me/a.jpg', url: 'https://signed/a.jpg' })
    vi.mocked(browserApiClient.post).mockResolvedValue({})
    render(<DropoffForm orgs={[ORG]} />)
    expect(screen.getByText('Sorted, in the bag or box you will carry it in. It saves an argument at the door.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Photo of what you are bringing'), {
      target: { files: [new File(['x'], 'bag.jpg', { type: 'image/jpeg' })] },
    })
    expect(await screen.findByAltText('Photo of the sorted plastic')).toHaveAttribute('src', 'https://signed/a.jpg')
    fireEvent.change(screen.getByPlaceholderText('2.0'), { target: { value: '2.5' } })
    for (const line of RECYCLING_DECLARATION) fireEvent.click(screen.getByLabelText(line))
    fireEvent.click(screen.getByRole('button', { name: /Book the drop-off/ }))
    await waitFor(() =>
      expect(browserApiClient.post).toHaveBeenCalledWith(
        '/api/organizations/north/recycling',
        expect.objectContaining({ photo_url: 'me/a.jpg' })
      )
    )
  })
})

describe('DropoffForm booking', () => {
  beforeEach(() => vi.clearAllMocks())

  it('WI37 books the weight, polymer, declaration version and note, then opens My SPLAT', async () => {
    vi.mocked(browserApiClient.post).mockResolvedValue({})
    render(<DropoffForm orgs={[ORG]} />)
    fireEvent.change(screen.getByPlaceholderText('2.0'), { target: { value: '2.5' } })
    for (const line of RECYCLING_DECLARATION) fireEvent.click(screen.getByLabelText(line))
    fireEvent.click(screen.getByRole('button', { name: /Book the drop-off/ }))
    await waitFor(() =>
      expect(browserApiClient.post).toHaveBeenCalledWith('/api/organizations/north/recycling', {
        material: 'PLA',
        estimated_grams: 2500,
        condition_declared: true,
        declaration_version: DECLARATION_VERSION,
        note: '',
      })
    )
    expect(push).toHaveBeenCalledWith('/dashboard')
  })

  it('WI37 holds the booking until all seven declaration lines are ticked', () => {
    render(<DropoffForm orgs={[ORG]} />)
    fireEvent.change(screen.getByPlaceholderText('2.0'), { target: { value: '2.5' } })
    for (const line of RECYCLING_DECLARATION.slice(0, 6)) fireEvent.click(screen.getByLabelText(line))
    expect(screen.getByRole('button', { name: /Book the drop-off/ })).toBeDisabled()
    fireEvent.click(screen.getByLabelText(RECYCLING_DECLARATION[6]))
    expect(screen.getByRole('button', { name: /Book the drop-off/ })).toBeEnabled()
  })

  it('WI37 shows the server sentence and stays put when the booking is refused', async () => {
    vi.mocked(browserApiClient.post).mockRejectedValue(new Error('That is under the two-kilo minimum.'))
    render(<DropoffForm orgs={[ORG]} />)
    fireEvent.change(screen.getByPlaceholderText('2.0'), { target: { value: '2.5' } })
    for (const line of RECYCLING_DECLARATION) fireEvent.click(screen.getByLabelText(line))
    fireEvent.click(screen.getByRole('button', { name: /Book the drop-off/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('That is under the two-kilo minimum.')
    expect(push).not.toHaveBeenCalled()
  })
})

describe('DropoffForm per-drop limits', () => {
  it('holds a weight over the organisation’s maximum, in the board’s words', () => {
    render(<DropoffForm orgs={[{ ...ORG, recycling_max_kg: 5 }]} />)
    expect(screen.getByText('Between 2 and 5 kg. They weigh it again at the door — this is just so they can plan.')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('2.0'), { target: { value: '6' } })
    expect(screen.getAllByText('Northside can take at most 5 kg in one drop. Split it across two.').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Book the drop-off/ })).toBeDisabled()
  })
})
