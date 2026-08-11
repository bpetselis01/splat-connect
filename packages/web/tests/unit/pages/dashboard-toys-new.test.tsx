import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import NewToyPage from '@/app/dashboard/toys/new/page'

vi.mock('@/lib/capabilities', () => ({ getCapabilities: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn() }),
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

  it('renders the create form for a signed-in account', async () => {
    vi.mocked(getCapabilities).mockResolvedValue({
      profile: { id: 'u1', name: 'Lee', email: 'lee@example.com', role: 'contributor' },
      isAdmin: false,
      ledOrgs: [],
      canAuthor: true,
      unreadNotifications: 0,
    } as never)
    render(await NewToyPage())
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /my toys/i })).toHaveAttribute('href', '/dashboard/toys')
  })
})
