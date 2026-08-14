import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ProfileForm } from '@/components/profile-form'
import type { Profile } from '@splat-connect/types'

const patch = vi.fn()
vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { patch: (...args: unknown[]) => patch(...args) },
}))

const PROFILE: Profile = {
  id: 'u1',
  name: 'Ada',
  email: 'ada@example.com',
  role: 'contributor',
  created_at: '2026-01-01T00:00:00.000Z',
}

describe('ProfileForm', () => {
  beforeEach(() => vi.clearAllMocks())

  it('saves a changed name', async () => {
    patch.mockResolvedValue({ ...PROFILE, name: 'Ada Lovelace' })
    render(<ProfileForm profile={PROFILE} />)

    fireEvent.change(screen.getByLabelText('Full name'), {
      target: { value: 'Ada Lovelace' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/api/contributors/me', expect.objectContaining({ name: 'Ada Lovelace' }))
    )
  })

  // Chain: email mirrors auth.users and is frozen by the 009 trigger. Offering
  //        an editable field would promise something the database refuses.
  it('shows email as read-only', () => {
    render(<ProfileForm profile={PROFILE} />)
    expect(screen.getByLabelText('Email')).toHaveAttribute('readonly')
  })

  it('reports a failed save instead of claiming success', async () => {
    patch.mockRejectedValue(new Error('boom'))
    render(<ProfileForm profile={PROFILE} />)

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not save/i)
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })

  it('saves the pickup address fields', async () => {
    patch.mockResolvedValue({ ...PROFILE, pickup_line1: '1 Test St', pickup_suburb: 'Testville', pickup_state: 'VIC', pickup_postcode: '3000' })
    render(<ProfileForm profile={PROFILE} />)

    fireEvent.change(screen.getByLabelText(/address line/i), {
      target: { value: '1 Test St' },
    })
    fireEvent.change(screen.getByLabelText(/suburb/i), {
      target: { value: 'Testville' },
    })
    fireEvent.change(screen.getByLabelText(/state/i), {
      target: { value: 'VIC' },
    })
    fireEvent.change(screen.getByLabelText(/postcode/i), {
      target: { value: '3000' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/api/contributors/me', expect.objectContaining({
        pickup_line1: '1 Test St',
        pickup_suburb: 'Testville',
        pickup_state: 'VIC',
        pickup_postcode: '3000'
      }))
    )
  })
})
