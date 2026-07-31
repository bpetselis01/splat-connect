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

function fillForm({ confirm = 'secret1' }: { confirm?: string } = {}) {
  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Ada' } })
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.co' } })
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'secret1' } })
  fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: confirm } })
}

function acceptTermsViaDialog() {
  fireEvent.click(screen.getByRole('button', { name: /read and accept/i }))
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: /^I accept/i }))
}

describe('signup page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signUp.mockResolvedValue({ error: null })
    // Expected under enable_confirmations = true: no session exists yet, so
    // this call fails every time. Signup must not be blocked by that.
    post.mockRejectedValue(new Error('no session'))
  })

  it('keeps submit disabled until the terms dialog is accepted', () => {
    render(<SignupPage />)
    fillForm()

    expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled()

    acceptTermsViaDialog()
    expect(screen.getByRole('button', { name: /create account/i })).toBeEnabled()
  })

  it('rejecting the terms dialog leaves submit disabled and the row unfilled', () => {
    render(<SignupPage />)
    fillForm()

    fireEvent.click(screen.getByRole('button', { name: /read and accept/i }))
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /reject/i }))

    expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /read and accept/i })).toBeInTheDocument()
  })

  it('typed fields survive opening and closing the terms dialog', () => {
    render(<SignupPage />)
    fillForm()
    acceptTermsViaDialog()

    expect(screen.getByLabelText(/full name/i)).toHaveValue('Ada')
    expect(screen.getByLabelText(/email/i)).toHaveValue('a@b.co')
  })

  it('blocks submission when the passwords do not match', () => {
    render(<SignupPage />)
    fillForm({ confirm: 'different' })
    acceptTermsViaDialog()

    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/passwords do not match/i)
    expect(signUp).not.toHaveBeenCalled()
  })

  it('shows check-your-email after a successful signup, with no dashboard link', async () => {
    render(<SignupPage />)
    fillForm()
    acceptTermsViaDialog()
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /check your email/i })).toBeInTheDocument()
    )
    expect(screen.queryByRole('link', { name: /dashboard/i })).not.toBeInTheDocument()
  })

  it('still shows check-your-email when recording the acceptance fails', async () => {
    render(<SignupPage />)
    fillForm()
    acceptTermsViaDialog()
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /check your email/i })).toBeInTheDocument()
    )
  })
})
