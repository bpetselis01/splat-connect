import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CantMakeItButton } from '@/app/dashboard/events/cant-make-it-button'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
const del = vi.fn()
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { delete: (...a: unknown[]) => del(...a) } }))

beforeEach(() => vi.clearAllMocks())

describe('CantMakeItButton', () => {
  it('WD26 withdraws the registration for that event, then refreshes My events', async () => {
    del.mockResolvedValue({})
    render(<CantMakeItButton eventId="ev1" />)
    fireEvent.click(screen.getByRole('button', { name: /Can.t make it/ }))
    await waitFor(() => expect(del).toHaveBeenCalledWith('/api/events/ev1/registrations'))
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
  })

  it('WD26 shows the API’s reason and keeps the row when the withdrawal fails', async () => {
    del.mockRejectedValue(new Error('Registration not found'))
    render(<CantMakeItButton eventId="ev1" />)
    fireEvent.click(screen.getByRole('button', { name: /Can.t make it/ }))
    expect(await screen.findByText('Registration not found')).toBeInTheDocument()
    expect(refresh).not.toHaveBeenCalled()
  })
})
