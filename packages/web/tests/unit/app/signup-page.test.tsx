import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SignupPage from '@/app/signup/page'
import { AGREEMENT_VERSIONS } from '@splat-connect/types'

const signUp = vi.fn()

// The page reads ?next= and ?reason= to carry a save detour through the email
// round trip and to explain why the visitor was sent here.
let search = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useSearchParams: () => search,
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
    search = new URLSearchParams()
    signUp.mockResolvedValue({ error: null })
  })

  it('WA10 keeps submit disabled until the terms dialog is accepted', () => {
    render(<SignupPage />)
    fillForm()

    expect(screen.getByRole('button', { name: /create my account/i })).toBeDisabled()

    acceptTermsViaDialog()
    expect(screen.getByRole('button', { name: /create my account/i })).toBeEnabled()
  })

  it('WA10 rejecting the terms dialog leaves submit disabled and the row unfilled', () => {
    render(<SignupPage />)
    fillForm()

    fireEvent.click(screen.getByRole('button', { name: /contributor terms/i }))
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /reject/i }))

    expect(screen.getByRole('button', { name: /create my account/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /contributor terms/i })).toBeInTheDocument()
  })

  it('WA10 typed fields survive opening and closing the terms dialog', () => {
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
  it('WA11 refuses to sign up when the passwords do not match', () => {
    render(<SignupPage />)
    fillForm()
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'secret2' } })
    acceptTermsViaDialog()
    fireEvent.click(screen.getByRole('button', { name: /create my account/i }))

    expect(screen.getByRole('alert')).toHaveTextContent("Passwords don't match.")
    expect(signUp).not.toHaveBeenCalled()
  })

  it('WA09 WA14 shows check-your-email after a successful signup, with a way back to sign in and no dashboard link', async () => {
    render(<SignupPage />)
    fillForm()
    acceptTermsViaDialog()
    fireEvent.click(screen.getByRole('button', { name: /create my account/i }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /check your email/i })).toBeInTheDocument()
    )
    expect(screen.queryByRole('link', { name: /dashboard/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/login')
    expect(screen.getByText('a@b.co')).toBeInTheDocument()
  })

  it('WA09 carries the accepted terms version through signUp() metadata', async () => {
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
  it('WA09 stores the picked intent in signUp() metadata', async () => {
    render(<SignupPage />)
    fireEvent.click(screen.getByLabelText(/make and share guides/i))
    fillForm()
    acceptTermsViaDialog()
    fireEvent.click(screen.getByRole('button', { name: /create my account/i }))
    await waitFor(() => expect(signUp).toHaveBeenCalled())
    expect(signUp.mock.calls[0][0].options.data.intent).toBe('maker')
  })

  it('WA09 sends no intent when no tile is picked', async () => {
    render(<SignupPage />)
    fillForm()
    acceptTermsViaDialog()
    fireEvent.click(screen.getByRole('button', { name: /create my account/i }))
    await waitFor(() => expect(signUp).toHaveBeenCalled())
    expect(signUp.mock.calls[0][0].options.data).not.toHaveProperty('intent')
  })

  it('WA09 sends the name and the email redirect that carries ?next= through the confirmation round trip', async () => {
    search = new URLSearchParams('next=%2Ftoy-library')
    render(<SignupPage />)
    fillForm()
    acceptTermsViaDialog()
    fireEvent.click(screen.getByRole('button', { name: /create my account/i }))
    await waitFor(() => expect(signUp).toHaveBeenCalled())
    const arg = signUp.mock.calls[0][0]
    expect(arg.email).toBe('a@b.co')
    expect(arg.password).toBe('secret1')
    expect(arg.options.data.name).toBe('Ada')
    expect(arg.options.emailRedirectTo).toBe(`${window.location.origin}/auth/confirmed?next=%2Ftoy-library`)
  })

  it('WA11 asks for at least six characters and marks the field so the browser refuses a shorter one', () => {
    render(<SignupPage />)
    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('minlength', '6')
    expect(screen.getByText('At least 6 characters')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'secret1' } })
    expect(screen.getByText('Long enough')).toBeInTheDocument()
  })

  it('WA12 shows the error and no confirmation when the email already has an account', async () => {
    signUp.mockResolvedValue({ error: { message: 'User already registered' } })
    render(<SignupPage />)
    fillForm()
    acceptTermsViaDialog()
    fireEvent.click(screen.getByRole('button', { name: /create my account/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('User already registered')
    expect(screen.queryByRole('heading', { name: /check your email/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create my account/i })).toBeEnabled()
  })

  it.each([
    ['save', "You need an account to save things. Create one and we'll take you back."],
    ['thanks', "You need an account to say thanks. Create one and we'll take you back."],
    ['child', "A free account keeps your child's profile. Create one and we'll take you straight to the questions."],
    ['download', "You need an account to download tutorial files. Create one and we'll take you back."],
    ['follow', 'Sign up to follow this organisation'],
    ['message', 'Sign up to message this organisation'],
    ['build', 'Sign up to request a build'],
  ])('WA13 ?reason=%s explains why the visitor was sent here', (reason, copy) => {
    search = new URLSearchParams({ reason })
    render(<SignupPage />)
    expect(screen.getByText(copy)).toBeInTheDocument()
  })
})
