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

  it('WA16 renders inside the auth stage, the same shell the sign-in page uses', () => {
    const { container } = render(<EmailConfirmedPage />)
    const card = container.querySelector('.auth-stage .auth-stage__column .auth-card')
    expect(card).not.toBeNull()
    expect(card!.querySelector('h1')).toHaveTextContent('Email confirmed')
  })

  it('WA16 offers an immediate manual sign-in link as a fallback', () => {
    render(<EmailConfirmedPage />)
    expect(screen.getByRole('link', { name: 'Continue' })).toHaveAttribute('href', '/login')
  })

  it('WA16 redirects to /login once the countdown finishes', () => {
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
  it('WA16 the Continue link carries ?next= too, so not waiting costs nothing', () => {
    search = new URLSearchParams('next=%2Flibrary')
    render(<EmailConfirmedPage />)
    expect(screen.getByRole('link', { name: 'Continue' })).toHaveAttribute('href', '/login?next=%2Flibrary')
  })

  it('WA16 hands ?next= on to /login, which already honours it', () => {
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
