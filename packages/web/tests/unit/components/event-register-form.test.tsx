import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EventRegisterForm } from '@/components/event-register-form'
import { browserApiClient } from '@/lib/browser-api-client'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { post: vi.fn() },
}))
const mockPost = vi.mocked(browserApiClient.post)

const base = {
  eventId: 'ev-1',
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

  it('a costed event holds the confirm until the money line is acknowledged', async () => {
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

  it('treats $0 as free', () => {
    render(<EventRegisterForm {...base} costCents={0} />)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(mockPost).not.toHaveBeenCalled()
  })
})
