import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CodeSignInPage from '@/app/login/code/page'
import LoginPage from '@/app/login/page'

let search = new URLSearchParams()
const push = vi.fn()
vi.mock('next/navigation', () => ({ useSearchParams: () => search, useRouter: () => ({ push }) }))

const signInWithOtp = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signInWithOtp: (...a: unknown[]) => signInWithOtp(...a) } }),
}))

function send(email: string) {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: email } })
  fireEvent.click(screen.getByRole('button', { name: 'Send code' }))
}

describe('code sign-in page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    search = new URLSearchParams()
    signInWithOtp.mockResolvedValue({ error: null })
  })

  it('WA35 sends a sign-in code without creating an account, then opens the verify screen', async () => {
    render(<CodeSignInPage />)
    send(' a@b.co ')
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login/verify?email=a%40b.co&type=email'))
    expect(signInWithOtp).toHaveBeenCalledWith({ email: 'a@b.co', options: { shouldCreateUser: false } })
  })

  it('WA35 hands ?next= on to the verify screen and back to the password page', async () => {
    search = new URLSearchParams({ email: 'a@b.co', next: '/toy-library' })
    render(<CodeSignInPage />)
    expect(screen.getByRole('link', { name: 'Use a password instead' })).toHaveAttribute('href', '/login?next=%2Ftoy-library')
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login/verify?email=a%40b.co&type=email&next=%2Ftoy-library'))
  })

  it('WA35 refuses an empty or malformed email before asking Supabase', () => {
    render(<CodeSignInPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Add your email.')
    send('not-an-email')
    expect(screen.getByRole('alert')).toHaveTextContent("That email address doesn't look right.")
    expect(signInWithOtp).not.toHaveBeenCalled()
  })

  it('WA36 an email with no account says so and offers to create one', async () => {
    search = new URLSearchParams({ next: '/toy-library' })
    signInWithOtp.mockResolvedValue({ error: { code: 'otp_disabled', message: 'Signups not allowed for otp' } })
    render(<CodeSignInPage />)
    send('nobody@b.co')
    expect(await screen.findByRole('alert')).toHaveTextContent('No account uses that email.')
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/signup?next=%2Ftoy-library')
    expect(push).not.toHaveBeenCalled()
  })
})

describe('login page link to the code page', () => {
  it('WA35 Email me a sign-in code carries the typed email', () => {
    search = new URLSearchParams()
    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.co' } })
    expect(screen.getByRole('link', { name: 'Email me a sign-in code' })).toHaveAttribute('href', '/login/code?email=a%40b.co')
  })

  it('WA35 the sign-in page starts with the email it was sent', () => {
    search = new URLSearchParams({ email: 'a@b.co' })
    render(<LoginPage />)
    expect(screen.getByLabelText(/email/i)).toHaveValue('a@b.co')
  })
})
