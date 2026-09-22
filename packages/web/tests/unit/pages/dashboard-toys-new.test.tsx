import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import NewToyPage from '@/app/dashboard/toys/new/page'

vi.mock('@/lib/capabilities', () => ({ getCapabilities: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/dashboard/toys/new',
  useSearchParams: () => new URLSearchParams(''),
}))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))

import { getCapabilities } from '@/lib/capabilities'
import { redirect } from 'next/navigation'

describe('NewToyPage', () => {
  beforeEach(() => vi.resetAllMocks())

  it('redirects to /login when signed out', async () => {
    vi.mocked(getCapabilities).mockResolvedValue(null)
    vi.mocked(redirect).mockImplementation(() => { throw new Error('NEXT_REDIRECT') })
    await expect(NewToyPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/login')
  })

  function signedIn() {
    vi.mocked(getCapabilities).mockResolvedValue({
      profile: { id: 'u1', name: 'Lee', email: 'lee@example.com', role: 'contributor' },
      isAdmin: false,
      ledOrgs: [],
    } as never)
  }

  it('renders the create form for a signed-in account', async () => {
    signedIn()
    render(await NewToyPage())
    expect(screen.getByLabelText('What is it?')).toBeInTheDocument()
    // The way back to My toys is the breadcrumb trail, which app/layout.tsx
    // renders above this page rather than the page rendering it itself — see
    // lib/trail.ts and tests/unit/lib/trail.test.ts.
  })

  // The board's single card: no locked wizard pills ahead of the toy existing.
  it('shows the board heading and no wizard', async () => {
    signedIn()
    render(await NewToyPage())
    expect(screen.getByRole('heading', { name: 'Add a toy' })).toBeInTheDocument()
    expect(screen.queryByRole('tab')).toBeNull()
  })
})
