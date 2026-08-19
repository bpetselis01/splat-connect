import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NotifyForm } from '@/components/notify-form'

describe('NotifyForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('posts the email and the feature key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetchMock)

    render(<NotifyForm featureKey="requests" />)
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /tell me/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/api\/public\/notify$/)
    expect(JSON.parse(init.body)).toEqual({ email: 'a@example.com', featureKey: 'requests' })
  })

  it('confirms once it succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }))
    render(<NotifyForm featureKey="events" />)
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /tell me/i }))
    expect(await screen.findByText(/we'll email you/i)).toBeInTheDocument()
  })

  // A failed submit must not eat what the visitor typed.
  it('keeps the typed address when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    render(<NotifyForm featureKey="news" />)
    const input = screen.getByLabelText(/email/i)
    fireEvent.change(input, { target: { value: 'keep@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /tell me/i }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(input).toHaveValue('keep@example.com')
  })
})
