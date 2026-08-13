import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NewToyForm } from '@/components/new-toy-form'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { post: vi.fn() },
}))

import { browserApiClient } from '@/lib/browser-api-client'

describe('NewToyForm', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates the toy and redirects to its edit page', async () => {
    vi.mocked(browserApiClient.post).mockResolvedValue({ id: 't1' })
    render(<NewToyForm />)

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Fire truck' } })
    fireEvent.change(screen.getByLabelText('Condition (1–10)'), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Loud siren' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard/toys/t1?step=photos'))
    expect(browserApiClient.post).toHaveBeenCalledWith('/api/toys', {
      name: 'Fire truck',
      condition: 7,
      description: 'Loud siren',
    })
  })

  it('sends null for an empty description', async () => {
    vi.mocked(browserApiClient.post).mockResolvedValue({ id: 't1' })
    render(<NewToyForm />)

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Blocks' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(push).toHaveBeenCalled())
    expect(browserApiClient.post).toHaveBeenCalledWith(
      '/api/toys',
      expect.objectContaining({ description: null })
    )
  })

  it('shows an error and stays on the form when creation fails', async () => {
    vi.mocked(browserApiClient.post).mockRejectedValue(new Error('boom'))
    render(<NewToyForm />)

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Blocks' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not create this toy')
    expect(push).not.toHaveBeenCalled()
  })

  it('defaults condition to 5', () => {
    render(<NewToyForm />)
    expect(screen.getByLabelText('Condition (1–10)')).toHaveValue(5)
  })
})
