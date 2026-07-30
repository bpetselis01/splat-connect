import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SignupPage from '@/app/signup/page'

const signUp = vi.fn()
const post = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signUp: (...a: unknown[]) => signUp(...a) } }),
}))
vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { post: (...a: unknown[]) => post(...a) },
}))

function fillForm() {
  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Ada' } })
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.co' } })
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret1' } })
}

describe('signup page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signUp.mockResolvedValue({ error: null })
    post.mockResolvedValue({})
  })

  it('keeps submit disabled until the terms box is ticked', () => {
    render(<SignupPage />)
    fillForm()

    expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled()

    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByRole('button', { name: /create account/i })).toBeEnabled()
  })

  it('records the acceptance after the account is created', async () => {
    render(<SignupPage />)
    fillForm()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/agreements', {
        agreement_type: 'contributor_terms',
      })
    )
  })

  it('still creates the account when recording the acceptance fails', async () => {
    post.mockRejectedValue(new Error('network'))
    render(<SignupPage />)
    fillForm()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    // The success screen is what proves signup was not rolled back or blocked.
    await waitFor(() => expect(screen.getByText(/you're all set/i)).toBeInTheDocument())
  })
})
