import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import EmailConfirmedPage from '@/app/auth/confirmed/page'

const replace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}))

describe('email confirmed page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('tells the user they are being redirected, not just to close the tab', () => {
    render(<EmailConfirmedPage />)
    expect(screen.getByText(/redirecting you to sign in/i)).toBeInTheDocument()
  })

  it('offers an immediate manual sign-in link as a fallback', () => {
    render(<EmailConfirmedPage />)
    expect(screen.getByRole('link', { name: /sign in now/i })).toHaveAttribute('href', '/login')
  })

  it('redirects to /login once the countdown finishes', () => {
    render(<EmailConfirmedPage />)
    expect(replace).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(replace).toHaveBeenCalledWith('/login')
  })

  it('does not redirect before the countdown finishes', () => {
    render(<EmailConfirmedPage />)

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(replace).not.toHaveBeenCalled()
  })
})
