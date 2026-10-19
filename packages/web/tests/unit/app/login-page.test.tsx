import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LoginPage from '@/app/login/page'

let search = new URLSearchParams()
vi.mock('next/navigation', () => ({ useSearchParams: () => search }))

const signInWithPassword = vi.fn()
let role = 'contributor'
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: (...a: unknown[]) => signInWithPassword(...a),
      getUser: async () => ({ data: { user: { id: 'u1', user_metadata: {} } } }),
      updateUser: vi.fn(),
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

  it('WA03 shows the auth error and stays put when the password is wrong', async () => {
    signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    render(<LoginPage />)
    await submit('wrong')
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid login credentials')
    expect(window.location.href).toBe('')
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeEnabled()
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

  // Q2: web has no forgot-password and no resend-confirmation.
  it('WA08 shows the raw unconfirmed-email error and offers no resend or reset control', async () => {
    signInWithPassword.mockResolvedValue({ error: { message: 'Email not confirmed' } })
    render(<LoginPage />)
    await submit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Email not confirmed')
    expect(screen.queryByRole('button', { name: /resend|forgot|reset/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /resend|forgot|reset/i })).not.toBeInTheDocument()
  })
})
