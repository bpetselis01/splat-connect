import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import SignupPage from '@/app/signup/page'

// The page reads ?next= and ?reason= for the save detour.
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}))

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
})
