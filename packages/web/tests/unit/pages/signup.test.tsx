import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import SignupPage from '@/app/signup/page'

// The page reads ?next= and ?reason= for the save detour.
let search = ''
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search),
}))
// Reset here, not at the end of the test that sets it: a failing assertion
// would otherwise leave the query string in place for whatever runs next.
afterEach(() => {
  search = ''
})

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signUp: vi.fn() } }),
}))

describe('signup copy', () => {
  // Chain: the approval gate was removed on Jul 23 and the words stayed. This
  //        copy already survived one cleanup it should not have, so it is
  //        asserted directly rather than left to review.
  it('does not describe the account as a request for access', () => {
    render(<SignupPage />)

    expect(screen.queryByText(/Request contributor access/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Request access/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Already have access/i)).not.toBeInTheDocument()
  })

  it('offers to create an account', () => {
    render(<SignupPage />)
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument()
  })

  // The download detour says why the visitor is here, the way the save one
  // does — a signup page with no explanation reads as a paywall.
  it('explains the download detour', () => {
    search = 'next=%2Ftutorials%2Ft1&reason=download'
    render(<SignupPage />)
    expect(
      screen.getByText("You need an account to download tutorial files. Create one and we'll take you back.")
    ).toBeInTheDocument()
  })
})
