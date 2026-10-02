import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SignupPage from '@/app/signup/page'
import { AGREEMENT_VERSIONS } from '@splat-connect/types'

const signUp = vi.fn()

// The page reads ?next= and ?reason= to carry a save detour through the email
// round trip and to explain why the visitor was sent here.
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signUp: (...a: unknown[]) => signUp(...a) } }),
}))

function fillForm() {
  fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Ada' } })
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.co' } })
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'secret1' } })
  fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'secret1' } })
}

function acceptTermsViaDialog() {
  fireEvent.click(screen.getByRole('button', { name: /contributor terms/i }))
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: /^I accept/i }))
}

describe('signup page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signUp.mockResolvedValue({ error: null })
  })

  it('keeps submit disabled until the terms dialog is accepted', () => {
    render(<SignupPage />)
    fillForm()

    expect(screen.getByRole('button', { name: /create my account/i })).toBeDisabled()

    acceptTermsViaDialog()
    expect(screen.getByRole('button', { name: /create my account/i })).toBeEnabled()
  })

  it('rejecting the terms dialog leaves submit disabled and the row unfilled', () => {
    render(<SignupPage />)
    fillForm()

    fireEvent.click(screen.getByRole('button', { name: /contributor terms/i }))
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /reject/i }))

    expect(screen.getByRole('button', { name: /create my account/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /contributor terms/i })).toBeInTheDocument()
  })

  it('typed fields survive opening and closing the terms dialog', () => {
    render(<SignupPage />)
    fillForm()
    acceptTermsViaDialog()

    expect(screen.getByLabelText(/your name/i)).toHaveValue('Ada')
    expect(screen.getByLabelText(/email/i)).toHaveValue('a@b.co')
  })

  // Chain: the show toggle reveals both fields, so the two can be compared
  it('shows and hides both password fields together', () => {
    render(<SignupPage />)
    const field = screen.getByLabelText(/^password$/i)
    const confirm = screen.getByLabelText(/confirm password/i)
    expect(field).toHaveAttribute('type', 'password')
    expect(confirm).toHaveAttribute('type', 'password')
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(field).toHaveAttribute('type', 'text')
    expect(confirm).toHaveAttribute('type', 'text')
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(field).toHaveAttribute('type', 'password')
  })

  // Chain: a typo in a password nobody can see locks the account's owner out
  //        at the first sign-in, so a mismatch stops the signup
  it('refuses to sign up when the passwords do not match', () => {
    render(<SignupPage />)
    fillForm()
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'secret2' } })
    acceptTermsViaDialog()
    fireEvent.click(screen.getByRole('button', { name: /create my account/i }))

    expect(screen.getByRole('alert')).toHaveTextContent("Passwords don't match.")
    expect(signUp).not.toHaveBeenCalled()
  })

  it('shows check-your-email after a successful signup, with no dashboard link', async () => {
    render(<SignupPage />)
    fillForm()
    acceptTermsViaDialog()
    fireEvent.click(screen.getByRole('button', { name: /create my account/i }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /check your email/i })).toBeInTheDocument()
    )
    expect(screen.queryByRole('link', { name: /dashboard/i })).not.toBeInTheDocument()
  })

  it('carries the accepted terms version through signUp() metadata', async () => {
    render(<SignupPage />)
    fillForm()
    acceptTermsViaDialog()
    fireEvent.click(screen.getByRole('button', { name: /create my account/i }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /check your email/i })).toBeInTheDocument()
    )
    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          data: expect.objectContaining({
            contributor_terms_version: AGREEMENT_VERSIONS.contributor_terms,
          }),
        }),
      })
    )
  })

  // The board's "I'm mostly here to…" — stored in metadata, never guessed.
  it('stores the picked intent in signUp() metadata', async () => {
    render(<SignupPage />)
    fireEvent.click(screen.getByLabelText(/make and share guides/i))
    fillForm()
    acceptTermsViaDialog()
    fireEvent.click(screen.getByRole('button', { name: /create my account/i }))
    await waitFor(() => expect(signUp).toHaveBeenCalled())
    expect(signUp.mock.calls[0][0].options.data.intent).toBe('maker')
  })

  it('sends no intent when no tile is picked', async () => {
    render(<SignupPage />)
    fillForm()
    acceptTermsViaDialog()
    fireEvent.click(screen.getByRole('button', { name: /create my account/i }))
    await waitFor(() => expect(signUp).toHaveBeenCalled())
    expect(signUp.mock.calls[0][0].options.data).not.toHaveProperty('intent')
  })
})
