import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { EditItemsSection } from '@/components/edit-items-section'
import { ToastProvider } from '@/components/toast'
import { renderLeavable } from '@/tests/unit/leaving'

describe('EditItemsSection save feedback', () => {
  it('shows a "Last saved" line after adding an item', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<EditItemsSection noun="part" initialItems={[]} onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: /Add a part/ }))
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Screw' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add part' }))
    await waitFor(() => expect(screen.getByText(/last saved just now/i)).toBeInTheDocument())
  })

  it('fires the shared toast with "Part added" after adding an item', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <ToastProvider>
        <EditItemsSection noun="part" initialItems={[]} onSave={onSave} />
      </ToastProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: /Add a part/ }))
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Screw' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add part' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Part added'))
  })

  it('fires the shared toast with "Tool removed" after deleting an item', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <ToastProvider>
        <EditItemsSection
          noun="tool"
          initialItems={[{ id: 'i1', name: 'Screwdriver', is_optional: false, buy_links: [] }]}
          onSave={onSave}
        />
      </ToastProvider>
    )
    fireEvent.click(screen.getByText('Screwdriver'))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Tool removed'))
  })
})

describe('EditItemsSection on leaving the step', () => {
  // Tests: a half-typed row is written rather than thrown away
  // Chain: the panels unmount on a step change, and the Add form is uncontrolled —
  //        so a part typed but not added was gone the moment you clicked Tools.
  //        This is the case the change was asked for
  it('adds what is typed into the Add form', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { leave } = renderLeavable(
      <ToastProvider>
        <EditItemsSection noun="part" initialItems={[]} onSave={onSave} />
      </ToastProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: /Add a part/ }))
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'M3 screw' } })

    expect(await leave()).toBe(true)
    expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'M3 screw' }),
    ])
  })

  // Tests: an empty Add form is not a reason to write anything
  // Chain: name is the one field the server requires and the input is `required`,
  //        so there is no row here it would accept. Writing the existing list back
  //        unchanged on every pill click would be a request for nothing
  it('writes nothing when the Add form is empty', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { leave, holding } = renderLeavable(
      <ToastProvider>
        <EditItemsSection noun="part" initialItems={[]} onSave={onSave} />
      </ToastProvider>
    )
    expect(holding()).toBe(false)
    expect(await leave()).toBe(true)
    expect(onSave).not.toHaveBeenCalled()
  })

  // Tests: an open row's edits and a typed Add row go in one write
  // Chain: each of the existing handlers builds its payload from `items`, and
  //        setItems is not visible to the next statement — running one then the
  //        other would write the second on top of a list that never learnt about
  //        the first, silently dropping it
  //
  // Only one editor is open at a time now, so the two drafts are built in this
  // order: type the new row, then open an item, which collapses the add row
  // without unmounting its form. That collapsed draft still has to reach the
  // server, which is the half of this that the redesign could have broken.
  it('carries an open edit and a new row in a single save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { leave } = renderLeavable(
      <ToastProvider>
        <EditItemsSection
          noun="part"
          initialItems={[{ id: 'p1', name: 'Old', is_optional: false, buy_links: [] }]}
          onSave={onSave}
        />
      </ToastProvider>
    )
    const addRow = screen.getByRole('button', { name: /Add a part/ })
    fireEvent.click(addRow)
    const addForm = addRow.closest('form')!
    fireEvent.change(within(addForm).getByPlaceholderText('Name'), {
      target: { value: 'Brand new' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Old/ }))
    fireEvent.change(screen.getByDisplayValue('Old'), { target: { value: 'Renamed' } })

    expect(await leave()).toBe(true)
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'Renamed' }),
      expect.objectContaining({ name: 'Brand new' }),
    ])
  })

  // Tests: collapsing the add row keeps what was typed into it
  // Chain: the fields are uncontrolled, so unmounting the form on collapse
  //        would silently bin a half-typed row every time someone clicked an
  //        item to edit
  it('keeps a typed row when the add row is collapsed and reopened', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    renderLeavable(
      <ToastProvider>
        <EditItemsSection noun="part" initialItems={[]} onSave={onSave} />
      </ToastProvider>
    )
    const addRow = screen.getByRole('button', { name: /Add a part/ })
    fireEvent.click(addRow)
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'M3 screw' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(addRow)
    expect(screen.getByPlaceholderText('Name')).toHaveValue('M3 screw')
  })

  // Tests: a failed write keeps the contributor on the step
  // Chain: the typed row exists only in this panel; unmounting is how it is lost
  it('reports a failed write so the step holds', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('nope'))
    const { leave } = renderLeavable(
      <ToastProvider>
        <EditItemsSection noun="part" initialItems={[]} onSave={onSave} />
      </ToastProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: /Add a part/ }))
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'M3 screw' } })
    expect(await leave()).toBe(false)
  })
})
