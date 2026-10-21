import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EventRegisterForm } from '@/components/event-register-form'
import { browserApiClient } from '@/lib/browser-api-client'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}))
vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { post: vi.fn() },
}))
const mockPost = vi.mocked(browserApiClient.post)

const base = {
  eventId: 'ev-1',
  orgId: 'org-9',
  orgName: 'Northside Therapy',
  questions: [],
  defaultName: 'Hana Kelly',
  defaultEmail: 'hana@example.com',
}

describe('EventRegisterForm and what the event costs (069)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('a free event draws no cost block, no box, and the plain confirm', () => {
    render(<EventRegisterForm {...base} costCents={null} />)
    expect(screen.queryByText(/what it costs you to come/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^confirm my spot$/i })).toBeEnabled()
    expect(screen.getByText(/free to attend/i)).toBeInTheDocument()
    // The consent line every registration carries.
    expect(screen.getByText(/only the host sees this/i)).toBeInTheDocument()
  })

  it('WI35 a costed event holds the confirm until the money line is acknowledged', async () => {
    mockPost.mockResolvedValue({})
    render(<EventRegisterForm {...base} costCents={1200} costNote="Parts kit per bench" />)
    expect(screen.getByRole('heading', { level: 3, name: '$12.00' })).toBeInTheDocument()
    expect(screen.getByText('Parts kit per bench')).toBeInTheDocument()
    const confirm = screen.getByRole('button', { name: /confirm my spot · \$12\.00/i })
    expect(confirm).toBeDisabled()
    expect(screen.getByText(/paid to Northside Therapy on the day/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: /SPLAT does not take the payment/i }))
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1))
    expect(mockPost.mock.calls[0][1]).toMatchObject({ cost_acknowledged: true })
  })

  it('WI35 posts the name, email and the answers to the organiser\'s questions, then returns to the event', async () => {
    mockPost.mockResolvedValue({})
    render(
      <EventRegisterForm
        {...base}
        questions={[
          { id: 'q1', event_id: 'ev-1', position: 1, prompt: 'Which toy are you bringing?', answer_type: 'short', required: true, options: [] },
          { id: 'q2', event_id: 'ev-1', position: 2, prompt: 'Any allergies?', answer_type: 'boolean', required: false, options: [] },
        ]}
      />
    )
    const confirm = screen.getByRole('button', { name: /^confirm my spot$/i })
    expect(confirm).toBeDisabled()
    expect(screen.getByText('1 required question still to answer.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/which toy are you bringing/i), { target: { value: 'Light-up penguin' } })
    fireEvent.click(screen.getByRole('radio', { name: 'No' }))
    fireEvent.change(screen.getByPlaceholderText('you@email.com'), { target: { value: 'hana.k@example.com' } })
    fireEvent.click(confirm)
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/events/ev-1/registrations', {
        name: 'Hana Kelly',
        email: 'hana.k@example.com',
        answers: { q1: 'Light-up penguin', q2: false },
      })
    )
    expect(push).toHaveBeenCalledWith('/get-involved/events/ev-1')
  })

  const conflict = (message: string) =>
    Object.assign(new Error(`API POST /api/events/ev-1/registrations failed with status 409: ${message}`), {
      status: 409,
      code: message,
    })

  it('WI35 a full event shows the full copy with the host contact and no submit', async () => {
    mockPost.mockRejectedValue(conflict('This one is full. The host may open more seats.'))
    render(<EventRegisterForm {...base} />)
    fireEvent.click(screen.getByRole('button', { name: /^confirm my spot$/i }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('This event is full. Contact Northside Therapy to ask about more seats.')
    expect(screen.getByRole('link', { name: /contact northside therapy/i })).toHaveAttribute(
      'href',
      '/organizations/org-9/public',
    )
    expect(alert).not.toHaveTextContent(/API POST/)
    expect(screen.queryByRole('button', { name: /confirm my spot/i })).not.toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })

  it('WI35 any other 409 shows a generic retry message and keeps the form', async () => {
    mockPost.mockRejectedValue(conflict('This event has been cancelled.'))
    render(<EventRegisterForm {...base} />)
    fireEvent.click(screen.getByRole('button', { name: /^confirm my spot$/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('That did not save. Try once more.')
    expect(screen.getByRole('button', { name: /^confirm my spot$/i })).toBeEnabled()
  })

  it('treats $0 as free', () => {
    render(<EventRegisterForm {...base} costCents={0} />)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(mockPost).not.toHaveBeenCalled()
  })
})
