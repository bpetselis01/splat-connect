import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ContributorTermsOnboarding from '@/app/onboarding/contributor-terms/page'

const post = vi.fn()
const replace = vi.fn()
let search = ''

vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { post: (...a: unknown[]) => post(...a) },
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(search),
}))

describe('contributor terms onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    search = ''
    post.mockResolvedValue({})
  })

  it('returns the user to the path they were blocked from', async () => {
    search = 'next=%2Fmy-tutorials'
    render(<ContributorTermsOnboarding />)

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /I accept/i }))

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/my-tutorials'))
  })

  it('ignores an absolute next and falls back to the dashboard', async () => {
    search = 'next=https%3A%2F%2Fevil.example'
    render(<ContributorTermsOnboarding />)

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /I accept/i }))

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'))
  })

  it('ignores a protocol-relative next', async () => {
    search = 'next=%2F%2Fevil.example'
    render(<ContributorTermsOnboarding />)

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /I accept/i }))

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'))
  })
})
