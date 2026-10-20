import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import VerifyPage from '@/app/login/verify/page'

let search = new URLSearchParams({ email: 'a@b.co', type: 'email' })
vi.mock('next/navigation', () => ({ useSearchParams: () => search }))

const verifyOtp = vi.fn()
const resend = vi.fn()
const signInWithOtp = vi.fn()
const getUser = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      verifyOtp: (...a: unknown[]) => verifyOtp(...a),
      resend: (...a: unknown[]) => resend(...a),
      signInWithOtp: (...a: unknown[]) => signInWithOtp(...a),
      updateUser: vi.fn(),
      getUser: (...a: unknown[]) => getUser(...a),
    },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role: 'contributor' } }) }) }) }),
  }),
}))

// One second per act: React flushes the countdown's next timeout only when act exits.
async function tick(seconds: number) {
  for (let i = 0; i < seconds; i++) await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
}
const codeField = () => screen.getByLabelText('6-digit code')

describe('verify page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    search = new URLSearchParams({ email: 'a@b.co', type: 'email' })
    verifyOtp.mockResolvedValue({ error: null })
    resend.mockResolvedValue({ error: null })
    signInWithOtp.mockResolvedValue({ error: null })
    getUser.mockResolvedValue({ data: { user: { id: 'u1', user_metadata: {} } } })
    Object.defineProperty(window, 'location', { value: { href: '' }, writable: true })
  })
  afterEach(() => vi.useRealTimers())

  it('WA37 signs in the moment the sixth digit lands, with ?next= honoured', async () => {
    search = new URLSearchParams({ email: 'a@b.co', type: 'email', next: '/toy-library' })
    render(<VerifyPage />)
    fireEvent.change(codeField(), { target: { value: '12345' } })
    expect(verifyOtp).not.toHaveBeenCalled()
    fireEvent.change(codeField(), { target: { value: '123456' } })
    await waitFor(() => expect(window.location.href).toBe('/toy-library'))
    expect(verifyOtp).toHaveBeenCalledWith({ email: 'a@b.co', token: '123456', type: 'email' })
  })

  it('WA37 verifies a sign-up confirmation as type signup', async () => {
    search = new URLSearchParams({ email: 'a@b.co', type: 'signup' })
    render(<VerifyPage />)
    fireEvent.change(codeField(), { target: { value: '654321' } })
    await waitFor(() => expect(window.location.href).toBe('/dashboard'))
    expect(verifyOtp).toHaveBeenCalledWith({ email: 'a@b.co', token: '654321', type: 'signup' })
  })

  it('WA37 fires one verifyOtp and disables the field until it resolves', async () => {
    let finish!: (v: { error: null }) => void
    verifyOtp.mockReturnValue(new Promise((r) => (finish = r)))
    render(<VerifyPage />)
    fireEvent.change(codeField(), { target: { value: '123456' } })
    await waitFor(() => expect(codeField()).toBeDisabled())
    fireEvent.change(codeField(), { target: { value: '123457' } })
    expect(verifyOtp).toHaveBeenCalledTimes(1)
    await act(async () => finish({ error: null }))
  })

  it('WA37 a wrong code clears the field, says so, and a second try still goes through', async () => {
    verifyOtp.mockResolvedValueOnce({ error: { code: 'otp_expired', message: 'Token has expired or is invalid' } })
    render(<VerifyPage />)
    fireEvent.change(codeField(), { target: { value: '000000' } })
    expect(await screen.findByText("That code didn't work. Check the latest email, or send a new one.")).toBeInTheDocument()
    expect(codeField()).toHaveValue('')
    expect(codeField()).toBeEnabled()
    fireEvent.change(codeField(), { target: { value: '123456' } })
    await waitFor(() => expect(window.location.href).toBe('/dashboard'))
    expect(verifyOtp).toHaveBeenCalledTimes(2)
  })

  it('WA38 holds the resend for 60 seconds with a countdown, then sends a sign-in code and restarts it', async () => {
    vi.useFakeTimers()
    render(<VerifyPage />)
    expect(screen.getByText(/Resend code in 0:60/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Send a new code' })).not.toBeInTheDocument()
    await tick(59)
    expect(screen.getByText(/Resend code in 0:01/)).toBeInTheDocument()
    await tick(1)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send a new code' })) })
    expect(signInWithOtp).toHaveBeenCalledWith({ email: 'a@b.co', options: { shouldCreateUser: false } })
    expect(screen.getByText(/Resend code in 0:60/)).toBeInTheDocument()
  })

  it('WA38 resends a sign-up confirmation with resend({type:signup})', async () => {
    vi.useFakeTimers()
    search = new URLSearchParams({ email: 'a@b.co', type: 'signup' })
    render(<VerifyPage />)
    await tick(60)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send a new code' })) })
    expect(resend).toHaveBeenCalledWith({ type: 'signup', email: 'a@b.co' })
  })

  it('WA38 a refused resend shows the rate-limited copy and keeps the button', async () => {
    vi.useFakeTimers()
    resend.mockResolvedValue({ error: { status: 429, message: 'email rate limit exceeded' } })
    search = new URLSearchParams({ email: 'a@b.co', type: 'signup' })
    render(<VerifyPage />)
    await tick(60)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send a new code' })) })
    expect(screen.getByRole('alert')).toHaveTextContent('Too many tries. Wait a minute and try again.')
    expect(screen.getByRole('button', { name: 'Send a new code' })).toBeEnabled()
  })

  it('WA38 Wrong email? Change it goes back to the code page with the email, or to sign-up for a confirmation', () => {
    search = new URLSearchParams({ email: 'a@b.co', type: 'email', next: '/toy-library' })
    const { unmount } = render(<VerifyPage />)
    expect(screen.getByRole('link', { name: 'Wrong email? Change it' })).toHaveAttribute(
      'href',
      '/login/code?email=a%40b.co&next=%2Ftoy-library'
    )
    unmount()
    search = new URLSearchParams({ email: 'a@b.co', type: 'signup' })
    render(<VerifyPage />)
    expect(screen.getByRole('link', { name: 'Wrong email? Change it' })).toHaveAttribute('href', '/signup')
  })

  it('WA37 a failure after a good code frees the field and says so instead of hanging', async () => {
    getUser.mockRejectedValueOnce(new Error('network'))
    render(<VerifyPage />)
    fireEvent.change(codeField(), { target: { value: '123456' } })
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Try again in a minute.')
    await waitFor(() => expect(codeField()).toBeEnabled())
    expect(window.location.href).toBe('')
  })
})
