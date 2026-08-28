import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import EmailConfirmedPage from '@/app/auth/confirmed/page'

const replace = vi.fn()
let search = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => search,
}))

describe('email confirmed page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    search = new URLSearchParams()
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

  /**
   * The half of the save detour that makes it a detour rather than a dead end.
   * A signed-out visitor clicks save, is sent to /signup, confirms their email,
   * and lands here — without carrying `next` on to /login they arrive nowhere
   * near the twelve search results they started from.
   */
  it('hands ?next= on to /login, which already honours it', () => {
    search = new URLSearchParams('next=%2Flibrary')
    render(<EmailConfirmedPage />)
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(replace).toHaveBeenCalledWith('/login?next=%2Flibrary')
  })

  it('still goes to a bare /login when there is nowhere to go back to', () => {
    render(<EmailConfirmedPage />)
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(replace).toHaveBeenCalledWith('/login')
  })
})
