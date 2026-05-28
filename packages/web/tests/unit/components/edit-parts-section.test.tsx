import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditPartsSection } from '@/components/edit-parts-section'
import type { Part } from '@splat-connect/types'

const mockParts: Part[] = [
  {
    id: 'part-1',
    tutorial_id: 'tut-1',
    name: 'Solder Wire',
    quantity: 2,
    is_optional: false,
    buy_links: [],
  },
  {
    id: 'part-2',
    tutorial_id: 'tut-1',
    name: 'Heat Shrink',
    quantity: 10,
    is_optional: true,
    buy_links: [{ label: 'Jaycar', url: 'https://jaycar.com' }],
  },
]

function setup(onSave = vi.fn().mockResolvedValue(undefined), parts = mockParts) {
  return render(<EditPartsSection initialParts={parts} onSave={onSave} />)
}

describe('EditPartsSection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders existing part names', () => {
    setup()
    expect(screen.getByText(/Solder Wire/)).toBeInTheDocument()
    expect(screen.getByText(/Heat Shrink/)).toBeInTheDocument()
  })

  it('renders a chevron indicator on each part row', () => {
    setup()
    const chevrons = screen.getAllByText('▼')
    expect(chevrons).toHaveLength(2)
  })

  it('edit form is not visible before a row is expanded', () => {
    setup()
    expect(screen.queryByDisplayValue('Solder Wire')).not.toBeInTheDocument()
  })

  it('clicking a part row shows its edit form pre-filled with current values', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /Solder Wire/ }))
    expect(screen.getByDisplayValue('Solder Wire')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2')).toBeInTheDocument()
  })

  it('clicking Cancel hides the edit form', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /Solder Wire/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByDisplayValue('Solder Wire')).not.toBeInTheDocument()
  })

  it('clicking Save calls onSave with the updated part', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    setup(onSave)
    fireEvent.click(screen.getByRole('button', { name: /Solder Wire/ }))
    fireEvent.change(screen.getByDisplayValue('Solder Wire'), {
      target: { value: 'Solder Wire Thick' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const [savedParts] = onSave.mock.calls[0] as [{ name: string }[]]
    expect(savedParts[0].name).toBe('Solder Wire Thick')
  })

  it('clicking Delete calls onSave without the deleted part', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    setup(onSave)
    fireEvent.click(screen.getByRole('button', { name: /Solder Wire/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const [savedParts] = onSave.mock.calls[0] as [{ name: string }[]]
    expect(savedParts).toHaveLength(1)
    expect(savedParts[0].name).toBe('Heat Shrink')
  })

  it('submitting the Add part form calls onSave with the new part appended', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    setup(onSave)
    fireEvent.change(screen.getByPlaceholderText('Name'), {
      target: { value: 'New Part' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add part' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const [savedParts] = onSave.mock.calls[0] as [{ name: string }[]]
    expect(savedParts).toHaveLength(3)
    expect(savedParts[2].name).toBe('New Part')
  })

  it('shows an error message when onSave throws during edit save', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Network error'))
    setup(onSave)
    fireEvent.click(screen.getByRole('button', { name: /Solder Wire/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(screen.getByText('Failed to save, please try again')).toBeInTheDocument()
    )
  })
})
