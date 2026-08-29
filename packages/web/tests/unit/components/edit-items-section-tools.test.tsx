import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditItemsSection } from '@/components/edit-items-section'
import type { Tool } from '@splat-connect/types'

const mockTools: Tool[] = [
  {
    id: 'tool-1',
    tutorial_id: 'tut-1',
    name: 'Soldering Iron',
    is_optional: false,
    buy_links: [],
  },
  {
    id: 'tool-2',
    tutorial_id: 'tut-1',
    name: 'Heat Gun',
    is_optional: true,
    buy_links: [{ label: 'Jaycar', url: 'https://jaycar.com' }],
  },
]

function setup(onSave = vi.fn().mockResolvedValue(undefined), tools = mockTools) {
  return render(<EditItemsSection noun="tool" initialItems={tools} onSave={onSave} />)
}

describe('EditItemsSection (tools)', () => {
  beforeEach(() => vi.clearAllMocks())

  // Tests: EditItemsSection displays the names of all tools passed via initialTools
  // How:   setup() renders with mockTools (Soldering Iron, Heat Gun); checks both names visible
  // Chain: the edit form shows the tutorial's current tools → contributors can see what they
  //        saved and identify which tools to edit, delete, or leave as-is
  it('renders existing tool names', () => {
    setup()
    expect(screen.getByText(/Soldering Iron/)).toBeInTheDocument()
    expect(screen.getByText(/Heat Gun/)).toBeInTheDocument()
  })

  // Tests: each tool row says it is editable in words
  // Chain: same affordance as the parts table — the ▼ this replaced was the
  //        only thing marking a row as openable
  it('marks every tool row as an editable control', () => {
    setup()
    expect(screen.getAllByText('Edit')).toHaveLength(2)
  })

  // Tests: the tools table has no quantity column
  // How:   the Qty header the parts table carries is absent here
  // Chain: a tool is a tool — you do not need two soldering irons — so
  //        withQuantity is off and the row drops to two columns
  it('omits the quantity column tools have no use for', () => {
    setup()
    expect(screen.queryByText('Qty')).not.toBeInTheDocument()
  })

  // Tests: the tool edit form is hidden until its row is clicked
  // How:   checks queryByDisplayValue('Soldering Iron') is null before any click
  // Chain: the tools list stays compact until actively edited → the UI is readable even
  //        with many tools listed
  it('edit form is not visible before a row is expanded', () => {
    setup()
    expect(screen.queryByDisplayValue('Soldering Iron')).not.toBeInTheDocument()
  })

  // Tests: clicking a tool row shows an edit form pre-filled with the tool's current name
  // How:   fireEvent.click on 'Soldering Iron'; checks input displays 'Soldering Iron'
  // Chain: contributors can modify the exact saved value → the current name is the starting
  //        point for any edit, reducing re-entry effort
  it('clicking a tool row shows its edit form pre-filled with current values', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /Soldering Iron/ }))
    expect(screen.getByDisplayValue('Soldering Iron')).toBeInTheDocument()
  })

  // Tests: clicking Cancel collapses the form without saving
  // How:   expands 'Soldering Iron', clicks Cancel; checks input is gone from document
  // Chain: contributors can dismiss the form with no changes → the tool list returns to
  //        its original compact state
  it('clicking Cancel hides the edit form', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /Soldering Iron/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByDisplayValue('Soldering Iron')).not.toBeInTheDocument()
  })

  // Tests: changing a tool name and clicking Save calls onSave with the updated tools array
  // How:   changes value to 'Soldering Station', clicks Save; waitFor checks savedTools[0].name
  // Chain: the parent component persists the updated array → the tutorial detail page shows
  //        the corrected tool name after the save
  it('clicking Save calls onSave with the updated tool', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    setup(onSave)
    fireEvent.click(screen.getByRole('button', { name: /Soldering Iron/ }))
    fireEvent.change(screen.getByDisplayValue('Soldering Iron'), {
      target: { value: 'Soldering Station' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const [savedTools] = onSave.mock.calls[0] as [{ name: string }[]]
    expect(savedTools[0].name).toBe('Soldering Station')
  })

  // Tests: clicking Delete removes the tool and calls onSave with the remaining tools
  // How:   expands 'Soldering Iron', clicks Delete; waitFor checks array length is 1 and
  //        the remaining tool is 'Heat Gun'
  // Chain: the parent component persists the reduced array → the deleted tool no longer
  //        appears on the tutorial detail page
  it('clicking Delete calls onSave without the deleted tool', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    setup(onSave)
    fireEvent.click(screen.getByRole('button', { name: /Soldering Iron/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const [savedTools] = onSave.mock.calls[0] as [{ name: string }[]]
    expect(savedTools).toHaveLength(1)
    expect(savedTools[0].name).toBe('Heat Gun')
  })

  // Tests: filling the Add tool form and clicking Add tool calls onSave with the new tool appended
  // How:   fills Name input with 'New Tool', clicks 'Add tool'; checks onSave called with 3 tools
  // Chain: contributors can add multiple tools without a page reload → the tutorial's tools
  //        list grows immediately after each save
  it('submitting the Add tool form calls onSave with the new tool appended', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    setup(onSave)
    fireEvent.click(screen.getByRole('button', { name: /Add a tool/ }))
    fireEvent.change(screen.getByPlaceholderText('Name'), {
      target: { value: 'New Tool' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add tool' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const [savedTools] = onSave.mock.calls[0] as [{ name: string }[]]
    expect(savedTools).toHaveLength(3)
    expect(savedTools[2].name).toBe('New Tool')
  })

  // Tests: when onSave throws, the error message is displayed in the UI
  // How:   passes an onSave that rejects; expands and clicks Save; waitFor checks the error text
  // Chain: the contributor sees a retry prompt → they can attempt the save again rather than
  //        not knowing whether the operation succeeded or failed
  it('shows an error message when onSave throws during edit save', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Network error'))
    setup(onSave)
    fireEvent.click(screen.getByRole('button', { name: /Soldering Iron/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(screen.getByText('Failed to save, please try again')).toBeInTheDocument()
    )
  })
})
