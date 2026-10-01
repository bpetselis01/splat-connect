import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PrinterForm } from '@/components/printer-form'
import { browserApiClient } from '@/lib/browser-api-client'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: vi.fn() } }))

describe('PrinterForm', () => {
  it('sends the postcode, starting from the profile’s', async () => {
    const post = vi.mocked(browserApiClient.post).mockResolvedValue({})
    const { container } = render(<PrinterForm ledOrgs={[]} defaultPostcode="2042" />)
    fireEvent.change(container.querySelector('input[name="name"]')!, { target: { value: 'Garage Bambu' } })
    for (const [axis, v] of [['Bed width', '256'], ['Bed depth', '256'], ['Bed height', '256']]) {
      fireEvent.change(screen.getByLabelText(axis!), { target: { value: v } })
    }
    expect(screen.getByLabelText('Postcode')).toHaveValue('2042')
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/printers', expect.objectContaining({ postcode: '2042' })))
  })
})
