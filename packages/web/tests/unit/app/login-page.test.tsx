import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LoginPage from '@/app/login/page'

let search = new URLSearchParams()
vi.mock('next/navigation', () => ({ useSearchParams: () => search }))

const signInWithPassword = vi.fn()
const resend = vi.fn()
let role = 'contributor'
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: (...a: unknown[]) => signInWithPassword(...a),
      getUser: async () => ({ data: { user: { id: 'u1', user_metadata: {} } } }),
      updateUser: vi.fn(),
      resend: (...a: unknown[]) => resend(...a),
    },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role } }) }) }) }),
  }),
}))

async function submit(password = 'secret1') {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.co' } })
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
}

describe('login page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    search = new URLSearchParams()
    role = 'contributor'
    signInWithPassword.mockResolvedValue({ error: null })
    resend.mockResolvedValue({ error: null })
    Object.defineProperty(window, 'location', { value: { href: '' }, writable: true })
  })

  it('WA01 signs in with the typed email and password and lands on the dashboard', async () => {
    render(<LoginPage />)
    await submit()
    await waitFor(() => expect(window.location.href).toBe('/dashboard'))
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.co', password: 'secret1' })
  })

  it('WA02 sends an admin to /admin', async () => {
    role = 'admin'
    render(<LoginPage />)
    await submit()
    await waitFor(() => expect(window.location.href).toBe('/admin'))
  })

  it('WA03 says the email and password do not match, clears the password and keeps the email', async () => {
    signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    render(<LoginPage />)
    await submit('wrong')
    expect(await screen.findByRole('alert')).toHaveTextContent("That email and password don't match.")
    expect(screen.getByLabelText(/^password$/i)).toHaveValue('')
    expect(screen.getByLabelText(/email/i)).toHaveValue('a@b.co')
    expect(window.location.href).toBe('')
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeEnabled()
  })

  it('WA03 shows the rate-limited copy, never a raw lockout error', async () => {
    signInWithPassword.mockResolvedValue({ error: { status: 429, code: 'over_request_rate_limit', message: 'Request rate limit reached' } })
    render(<LoginPage />)
    await submit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many tries. Wait a minute and try again.')
  })

  it.each(['https://evil.example/x', '//evil.example', '/\\evil.example', 'javascript:alert(1)', 'library'])(
    'WA04 ignores the unsafe ?next=%s and lands on the dashboard',
    async (next) => {
      search = new URLSearchParams({ next })
      render(<LoginPage />)
      await submit()
      await waitFor(() => expect(window.location.href).toBe('/dashboard'))
    }
  )

  it('WA06 shows and hides the password', () => {
    render(<LoginPage />)
    const field = screen.getByLabelText(/^password$/i)
    expect(field).toHaveAttribute('type', 'password')
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(field).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(field).toHaveAttribute('type', 'password')
  })

  it('WA07 links to /signup, keeping the query string', () => {
    render(<LoginPage />)
    expect(screen.getByRole('link', { name: 'Create one' })).toHaveAttribute('href', '/signup')
  })

  it('WA07 keeps ?next= and ?reason= on the Create one link', () => {
    search = new URLSearchParams('next=%2Ftoy-library&reason=save')
    render(<LoginPage />)
    expect(screen.getByRole('link', { name: 'Create one' })).toHaveAttribute('href', '/signup?next=%2Ftoy-library&reason=save')
  })

  it('WA08 sends a new code for an unconfirmed email and links to the screen that takes it', async () => {
    signInWithPassword.mockResolvedValue({ error: { code: 'email_not_confirmed', message: 'Email not confirmed' } })
    render(<LoginPage />)
    await submit()
    expect(await screen.findByRole('alert')).toHaveTextContent('That email is not confirmed yet. We sent you a new code.')
    expect(resend).toHaveBeenCalledWith({ type: 'signup', email: 'a@b.co' })
    expect(screen.getByRole('link', { name: 'Enter the code' })).toHaveAttribute('href', '/login/verify?email=a%40b.co&type=signup')
  })

  it('WA08 carries ?next= to the code screen', async () => {
    search = new URLSearchParams({ next: '/toy-library' })
    signInWithPassword.mockResolvedValue({ error: { code: 'email_not_confirmed', message: 'Email not confirmed' } })
    render(<LoginPage />)
    await submit()
    expect(await screen.findByRole('link', { name: 'Enter the code' })).toHaveAttribute(
      'href',
      '/login/verify?email=a%40b.co&type=signup&next=%2Ftoy-library'
    )
  })

  it('WA08 shows the rate-limited copy when the resend is refused, without an Enter the code link', async () => {
    signInWithPassword.mockResolvedValue({ error: { code: 'email_not_confirmed', message: 'Email not confirmed' } })
    resend.mockResolvedValue({ error: { status: 429, code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' } })
    render(<LoginPage />)
    await submit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many tries. Wait a minute and try again.')
    expect(screen.queryByRole('link', { name: 'Enter the code' })).not.toBeInTheDocument()
  })
})
