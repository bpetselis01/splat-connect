import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NewToyForm } from '@/components/new-toy-form'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { post: vi.fn(), patch: vi.fn(), postFormData: vi.fn() },
}))

import { browserApiClient } from '@/lib/browser-api-client'

describe('NewToyForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(browserApiClient.patch).mockResolvedValue({})
  })

  it('creates the toy, marks it switch-adapted, and opens the listing editor', async () => {
    vi.mocked(browserApiClient.post).mockResolvedValue({ id: 't1' })
    render(<NewToyForm />)

    fireEvent.change(screen.getByLabelText('What is it?'), { target: { value: 'Fire truck' } })
    fireEvent.change(screen.getByLabelText('Condition (1–10)'), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: /Create listing/ }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard/toys/t1'))
    expect(browserApiClient.post).toHaveBeenCalledWith('/api/toys', {
      name: 'Fire truck',
      condition: 7,
      description: null,
    })
    // Switch-adapted is the default card, and the create route does not take it.
    expect(browserApiClient.patch).toHaveBeenCalledWith('/api/toys/t1', { switch_adapted: true })
  })

  it('sends nothing more for a standard toy with no photos', async () => {
    vi.mocked(browserApiClient.post).mockResolvedValue({ id: 't1' })
    render(<NewToyForm />)

    fireEvent.click(screen.getByRole('radio', { name: /Standard toy/ }))
    fireEvent.change(screen.getByLabelText('What is it?'), { target: { value: 'Blocks' } })
    fireEvent.click(screen.getByRole('button', { name: /Create listing/ }))

    await waitFor(() => expect(push).toHaveBeenCalled())
    expect(browserApiClient.patch).not.toHaveBeenCalled()
  })

  it('shows an error and stays on the form when creation fails', async () => {
    vi.mocked(browserApiClient.post).mockRejectedValue(new Error('boom'))
    render(<NewToyForm />)

    fireEvent.change(screen.getByLabelText('What is it?'), { target: { value: 'Blocks' } })
    fireEvent.click(screen.getByRole('button', { name: /Create listing/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not create this toy')
    expect(push).not.toHaveBeenCalled()
  })

  it('defaults condition to 5', () => {
    render(<NewToyForm />)
    expect(screen.getByLabelText('Condition (1–10)')).toHaveValue(5)
  })
})
