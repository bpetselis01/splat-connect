import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditItemsSection } from '@/components/edit-items-section'
import { ToastProvider } from '@/components/toast'

describe('EditItemsSection save feedback', () => {
  it('shows a "Last saved" line after adding an item', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<EditItemsSection noun="part" initialItems={[]} onSave={onSave} />)
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
