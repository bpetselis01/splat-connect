import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditItemsSection } from '@/components/edit-items-section'
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
  return render(<EditItemsSection noun="part" withQuantity initialItems={parts} onSave={onSave} />)
}

describe('EditItemsSection (parts)', () => {
  beforeEach(() => vi.clearAllMocks())

  // Tests: EditItemsSection displays the names of all parts passed via initialParts
  // How:   setup() renders with mockParts (Solder Wire, Heat Shrink); checks both names visible
  // Chain: the edit form pre-loads the tutorial's current parts → contributors see what
  //        they've already saved and can choose which ones to edit or delete
  it('renders existing part names', () => {
    setup()
    expect(screen.getByText(/Solder Wire/)).toBeInTheDocument()
    expect(screen.getByText(/Heat Shrink/)).toBeInTheDocument()
  })

  // Tests: each part row shows a chevron (▼) to indicate it's expandable
  // How:   checks screen.getAllByText('▼') has length 2 (one per mock part)
  // Chain: the chevron communicates the expand/collapse interaction pattern → users know
  //        to click a row to reveal the inline edit form
  it('renders a chevron indicator on each part row', () => {
    setup()
    const chevrons = screen.getAllByText('▼')
    expect(chevrons).toHaveLength(2)
  })

  // Tests: the edit form (with input fields) is hidden until a row is clicked
  // How:   checks queryByDisplayValue('Solder Wire') returns null before any click
  // Chain: all parts show as compact rows by default → the UI stays readable when there
  //        are many parts, expanding only the one being edited
  it('edit form is not visible before a row is expanded', () => {
    setup()
    expect(screen.queryByDisplayValue('Solder Wire')).not.toBeInTheDocument()
  })

  // Tests: clicking a part row expands it to show an edit form pre-filled with the part's current values
  // How:   fireEvent.click on the 'Solder Wire' button; checks inputs display 'Solder Wire' and '2'
  // Chain: contributors can see and modify the exact values stored for that part → they don't
  //        need to re-enter unchanged fields when making a small correction
  it('clicking a part row shows its edit form pre-filled with current values', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /Solder Wire/ }))
    expect(screen.getByDisplayValue('Solder Wire')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2')).toBeInTheDocument()
  })

  // Tests: clicking Cancel collapses the edit form without saving changes
  // How:   expands a row, clicks Cancel; checks the input is no longer in the document
  // Chain: the row returns to its compact state with the original values unchanged →
  //        contributors can dismiss an accidental expand without triggering a save
  it('clicking Cancel hides the edit form', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /Solder Wire/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByDisplayValue('Solder Wire')).not.toBeInTheDocument()
  })

  // Tests: editing a part name and clicking Save calls onSave with the updated parts array
  // How:   expands row, changes name to 'Solder Wire Thick', clicks Save; waitFor checks
  //        onSave was called with savedParts[0].name === 'Solder Wire Thick'
  // Chain: the parent component receives the updated array and calls the API to persist it →
  //        the tutorial detail page shows the new part name after the save
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

  // Tests: clicking Delete removes that part from the array and calls onSave with the remaining parts
  // How:   expands 'Solder Wire', clicks Delete; waitFor checks onSave called with array of length 1
  //        and the remaining part is 'Heat Shrink'
  // Chain: the parent component persists the reduced array → the deleted part no longer
  //        appears on the tutorial detail page after the save completes
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

  // Tests: filling the Add part form and clicking Add part appends a new part and calls onSave
  // How:   fills the Name input, clicks 'Add part'; waitFor checks onSave called with 3 parts
  //        and savedParts[2].name === 'New Part'
  // Chain: the new part is persisted immediately after add → contributors can add multiple
  //        parts in sequence without reloading the page
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

  // Tests: when onSave throws, an error message is shown in the UI
  // How:   setup() passes an onSave that rejects; expands a row and clicks Save; waitFor checks
  //        'Failed to save, please try again' is in the document
  // Chain: the contributor sees a retry prompt instead of a silent failure → they can attempt
  //        the save again or refresh the page if the error persists
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
