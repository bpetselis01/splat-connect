import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Nav } from '@/components/nav'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: vi.fn() } }),
}))

describe('Nav', () => {
  it('renders library link for unauthenticated users', () => {
    render(<Nav role={null} />)
    expect(screen.getByRole('link', { name: /library/i })).toBeInTheDocument()
  })

  it('renders dashboard link for contributors', () => {
    render(<Nav role="contributor" />)
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
  })

  it('renders admin link for admin users', () => {
    render(<Nav role="admin" />)
    expect(screen.getByRole('link', { name: /admin/i })).toBeInTheDocument()
  })

  it('does not render dashboard link for admin users', () => {
    render(<Nav role="admin" />)
    expect(screen.queryByRole('link', { name: /dashboard/i })).toBeNull()
  })

  it('does not render admin link for contributors', () => {
    render(<Nav role="contributor" />)
    expect(screen.queryByRole('link', { name: /admin/i })).toBeNull()
  })
})
