import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ContributorTermsOnboarding from '@/app/onboarding/contributor-terms/page'

const post = vi.fn()
const signOut = vi.fn()
let search = ''

vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { post: (...a: unknown[]) => post(...a) },
}))
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search),
}))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: (...a: unknown[]) => signOut(...a) } }),
}))

describe('contributor terms onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    search = ''
    post.mockResolvedValue({})
    signOut.mockResolvedValue({})
    // A hard reload (not router.replace) is the intended navigation here — see
    // the onAccepted comment in app/onboarding/contributor-terms/page.tsx.
    // jsdom's real window.location.href setter throws "not implemented", so it
    // is swapped for a plain object these tests can read back.
    delete (window as unknown as { location?: unknown }).location
    ;(window as unknown as { location: { href: string } }).location = { href: '' }
  })

  it('WA17 records the acceptance, then returns the user to the path they were blocked from', async () => {
    search = 'next=%2Fmy-tutorials'
    render(<ContributorTermsOnboarding />)

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Accept and continue' }))

    await waitFor(() => expect(window.location.href).toBe('/my-tutorials'))
    expect(post).toHaveBeenCalledWith('/api/agreements', { agreement_type: 'contributor_terms' })
  })

  it('WA17 keeps Accept and continue disabled until the box is ticked, and does not post', () => {
    render(<ContributorTermsOnboarding />)
    const accept = screen.getByRole('button', { name: 'Accept and continue' })
    expect(accept).toBeDisabled()
    fireEvent.click(accept)
    expect(post).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(accept).toBeEnabled()
  })

  it('WA17 stays put and says so when the acceptance cannot be recorded', async () => {
    post.mockRejectedValue(new Error('403'))
    render(<ContributorTermsOnboarding />)
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Accept and continue' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not record your acceptance. Please try again.')
    expect(window.location.href).toBe('')
  })

  it('WA17 ignores an absolute next and falls back to the dashboard', async () => {
    search = 'next=https%3A%2F%2Fevil.example'
    render(<ContributorTermsOnboarding />)

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Accept and continue' }))

    await waitFor(() => expect(window.location.href).toBe('/dashboard'))
  })

  it('WA17 ignores a protocol-relative next', async () => {
    search = 'next=%2F%2Fevil.example'
    render(<ContributorTermsOnboarding />)

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Accept and continue' }))

    await waitFor(() => expect(window.location.href).toBe('/dashboard'))
  })

  it('WA17 ignores a backslash-based open redirect', async () => {
    search = 'next=%2F%5Cevil.example'
    render(<ContributorTermsOnboarding />)

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Accept and continue' }))

    await waitFor(() => expect(window.location.href).toBe('/dashboard'))
  })

  it('WA17 ignores an empty next parameter', async () => {
    search = 'next='
    render(<ContributorTermsOnboarding />)

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Accept and continue' }))

    await waitFor(() => expect(window.location.href).toBe('/dashboard'))
  })

  it('renders the terms content inline, not just a link', () => {
    render(<ContributorTermsOnboarding />)
    expect(screen.getByText(/have not been written yet/i)).toBeInTheDocument()
  })

  it('does not claim the account predates the terms', () => {
    render(<ContributorTermsOnboarding />)
    expect(screen.queryByText(/created before/i)).not.toBeInTheDocument()
  })

  it('WA18 signs out and goes to the home page', async () => {
    render(<ContributorTermsOnboarding />)
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))
    await waitFor(() => expect(window.location.href).toBe('/'))
    expect(signOut).toHaveBeenCalledTimes(1)
  })
})
