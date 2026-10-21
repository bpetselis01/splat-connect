import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ResetPasswordPage from '@/app/login/reset/page'

let search = new URLSearchParams({ email: 'a@b.co' })
vi.mock('next/navigation', () => ({ useSearchParams: () => search }))

const verifyOtp = vi.fn()
const updateUser = vi.fn()
const resetPasswordForEmail = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      verifyOtp: (...a: unknown[]) => verifyOtp(...a),
      updateUser: (...a: unknown[]) => updateUser(...a),
      resetPasswordForEmail: (...a: unknown[]) => resetPasswordForEmail(...a),
      getUser: async () => ({ data: { user: { id: 'u1', user_metadata: {} } } }),
    },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role: 'contributor' } }) }) }) }),
  }),
}))

function fill(code: string, password: string) {
  fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: code } })
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: password } })
}
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save and sign in' }))

describe('reset password page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    search = new URLSearchParams({ email: 'a@b.co' })
    verifyOtp.mockResolvedValue({ error: null })
    updateUser.mockResolvedValue({ error: null })
    resetPasswordForEmail.mockResolvedValue({ error: null })
    Object.defineProperty(window, 'location', { value: { href: '' }, writable: true })
  })

  it('WA33 verifies the recovery code, sets the password and lands on the dashboard', async () => {
    render(<ResetPasswordPage />)
    fill('123456', 'newsecret')
    save()
    await waitFor(() => expect(window.location.href).toBe('/dashboard'))
    expect(verifyOtp).toHaveBeenCalledWith({ email: 'a@b.co', token: '123456', type: 'recovery' })
    expect(updateUser).toHaveBeenCalledWith({ password: 'newsecret' })
  })

  it('WA33 honours a same-origin ?next= and drops an off-site one', async () => {
    search = new URLSearchParams({ email: 'a@b.co', next: '/toy-library' })
    render(<ResetPasswordPage />)
    fill('123456', 'newsecret')
    save()
    await waitFor(() => expect(window.location.href).toBe('/toy-library'))
  })

  it('WA33 field takes digits only, six at most', () => {
    render(<ResetPasswordPage />)
    const field = screen.getByLabelText('6-digit code')
    fireEvent.change(field, { target: { value: '12 34-56789' } })
    expect(field).toHaveValue('123456')
    expect(field).toHaveAttribute('inputmode', 'numeric')
    expect(field).toHaveAttribute('autocomplete', 'one-time-code')
  })

  it('WA33 a wrong code says so in a polite region and keeps what was typed in the password field', async () => {
    verifyOtp.mockResolvedValue({ error: { code: 'otp_expired', message: 'Token has expired or is invalid' } })
    render(<ResetPasswordPage />)
    fill('000000', 'newsecret')
    save()
    expect(await screen.findByText("That code didn't work. Check the latest email, or send a new one.")).toBeInTheDocument()
    expect(screen.getByLabelText('New password')).toHaveValue('newsecret')
    expect(document.getElementById('code-error')).toHaveAttribute('aria-live', 'polite')
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('WA34 refuses a 5-character password before the code is spent', () => {
    render(<ResetPasswordPage />)
    fill('123456', 'short')
    save()
    expect(screen.getByRole('alert')).toHaveTextContent('Use at least 6 characters for the password.')
    expect(verifyOtp).not.toHaveBeenCalled()
  })

  it('WA34 asks for all six digits before anything is sent', () => {
    render(<ResetPasswordPage />)
    fill('12345', 'newsecret')
    save()
    expect(screen.getByRole('alert')).toHaveTextContent('Type the 6-digit code from the email.')
    expect(verifyOtp).not.toHaveBeenCalled()
  })

  it('WA33 keeps the session when the password does not save, and retries updateUser alone', async () => {
    updateUser.mockResolvedValueOnce({ error: { status: 500, message: 'Database error updating user' } })
    render(<ResetPasswordPage />)
    fill('123456', 'newsecret')
    save()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your code worked but the password did not save. Try the password again.'
    )
    expect(screen.getByLabelText('6-digit code')).toBeDisabled()
    save()
    await waitFor(() => expect(window.location.href).toBe('/dashboard'))
    expect(verifyOtp).toHaveBeenCalledTimes(1)
    expect(updateUser).toHaveBeenCalledTimes(2)
  })

  it('WA33 says a too-weak password is too weak, not that nothing saved', async () => {
    updateUser.mockResolvedValueOnce({ error: { code: 'weak_password', message: 'Password should be at least 6 characters.' } })
    render(<ResetPasswordPage />)
    fill('123456', 'password')
    save()
    expect(await screen.findByRole('alert')).toHaveTextContent('That password is too weak.')
  })

  it('WA33 sends a new code on request', async () => {
    render(<ResetPasswordPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Send again' }))
    expect(await screen.findByText('Sent. Check your email.')).toBeInTheDocument()
    expect(resetPasswordForEmail).toHaveBeenCalledWith('a@b.co')
  })
})
