import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ForgotPasswordPage from '@/app/login/forgot/page'

let search = new URLSearchParams()
const push = vi.fn()
vi.mock('next/navigation', () => ({ useSearchParams: () => search, useRouter: () => ({ push }) }))

const resetPasswordForEmail = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { resetPasswordForEmail: (...a: unknown[]) => resetPasswordForEmail(...a) } }),
}))

function send(email: string) {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: email } })
  fireEvent.click(screen.getByRole('button', { name: 'Send code' }))
}

describe('forgot password page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    search = new URLSearchParams()
    resetPasswordForEmail.mockResolvedValue({ error: null })
  })

  it('WA31 sends the code to the trimmed email and moves on to the reset screen', async () => {
    render(<ForgotPasswordPage />)
    send('  a@b.co ')
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login/reset?email=a%40b.co'))
    expect(resetPasswordForEmail).toHaveBeenCalledWith('a@b.co')
  })

  it('WA31 starts with the email carried from the sign-in page, and hands ?next= on', async () => {
    search = new URLSearchParams({ email: 'kid@b.co', next: '/toy-library' })
    render(<ForgotPasswordPage />)
    expect(screen.getByLabelText(/email/i)).toHaveValue('kid@b.co')
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login/reset?email=kid%40b.co&next=%2Ftoy-library'))
  })

  it('WA32 moves on the same way when Supabase refuses for any reason that would reveal the account', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: { code: 'user_not_found', message: 'User not found' } })
    render(<ForgotPasswordPage />)
    send('nobody@b.co')
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login/reset?email=nobody%40b.co'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('WA32 stops and says so when offline or rate limited', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: { status: 429, message: 'email rate limit exceeded' } })
    render(<ForgotPasswordPage />)
    send('a@b.co')
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many tries. Wait a minute and try again.')
    expect(push).not.toHaveBeenCalled()
  })

  it('WA31 asks for an email before sending anything', () => {
    render(<ForgotPasswordPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Type the email you sign in with.')
    expect(resetPasswordForEmail).not.toHaveBeenCalled()
  })
})
