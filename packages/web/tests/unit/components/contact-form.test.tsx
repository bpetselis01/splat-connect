import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ContactForm } from '@/components/contact-form'

const post = vi.fn()
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: (...a: unknown[]) => post(...a) } }))

beforeEach(() => vi.clearAllMocks())

describe('ContactForm', () => {
  it('WS12 sends nothing from an empty form, and flags the name, email and message as required', () => {
    render(<ContactForm />)
    fireEvent.click(screen.getByRole('button', { name: /send message/i }))
    expect(post).not.toHaveBeenCalled()
    for (const field of [screen.getByLabelText(/your name/i), screen.getByLabelText(/^email$/i), screen.getByLabelText(/message/i)]) {
      expect(field).toBeRequired()
      expect(field).toBeInvalid()
    }
  })

  it('WS11 posts the chosen topic with trimmed fields and then says it is sent', async () => {
    post.mockResolvedValue({ ok: true })
    render(<ContactForm />)
    fireEvent.click(screen.getByRole('radio', { name: /safety report/i }))
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: '  Sam  ' } })
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'sam@example.com ' } })
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: ' Battery pack gets hot. ' } })
    fireEvent.click(screen.getByRole('button', { name: /send message/i }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sent. Thank you.' })).toBeInTheDocument())
    expect(post).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledWith('/api/public/contact', {
      topic: 'safety',
      name: 'Sam',
      email: 'sam@example.com',
      body: 'Battery pack gets hot.',
    })
    expect(screen.getByText(/safety report goes to the top of the queue/i)).toBeInTheDocument()
  })

  it('WS11 shows the server sentence and keeps the form when the send fails', async () => {
    post.mockRejectedValue(new Error('That email address does not look right.'))
    render(<ContactForm defaultName="Sam" defaultEmail="sam@example.com" />)
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'Hello' } })
    fireEvent.click(screen.getByRole('button', { name: /send message/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('That email address does not look right.')
    expect(screen.getByLabelText(/message/i)).toHaveValue('Hello')
  })
})
