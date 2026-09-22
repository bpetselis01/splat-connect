import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Breadcrumb } from '@/components/breadcrumb'

// usePathname is stubbed via a hoisted ref, same pattern as nav.test.tsx, so a
// rerender can simulate the soft <Link> transition that used to leave the
// previous page's breadcrumb stuck on screen (see breadcrumb.tsx's docstring).
const pathname = vi.hoisted(() => ({ current: '/' }))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.current,
}))

describe('Breadcrumb', () => {
  it('renders nothing on the homepage', () => {
    pathname.current = '/'
    render(<Breadcrumb />)
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument()
  })

  // The board draws no trail over an ordinary public page — the header says
  // where you are. Only five public child pages get one.
  it('renders nothing on a public page the board draws no trail over', () => {
    for (const path of ['/about', '/learn', '/get-involved/submit-an-idea']) {
      pathname.current = path
      const { unmount } = render(<Breadcrumb />)
      expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument()
      unmount()
    }
  })

  it('draws the account trail with the page itself unlinked', () => {
    pathname.current = '/dashboard/toys/new'
    render(<Breadcrumb />)
    expect(screen.getByRole('link', { name: 'My SPLAT' })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('link', { name: 'My toys' })).toHaveAttribute('href', '/dashboard/toys')
    expect(screen.getByText('Add a toy')).toHaveAttribute('aria-current', 'page')
  })

  it('links a registration back to its own event', () => {
    pathname.current = '/get-involved/events/abc/register'
    render(<Breadcrumb />)
    expect(screen.getByRole('link', { name: 'Events' })).toHaveAttribute('href', '/get-involved/events')
    expect(screen.getByRole('link', { name: 'Event detail' })).toHaveAttribute(
      'href',
      '/get-involved/events/abc'
    )
  })

  it('picks up a soft navigation to a page with no trail', () => {
    pathname.current = '/dashboard/toys/new'
    const { rerender } = render(<Breadcrumb />)
    expect(screen.getByText('My toys')).toBeInTheDocument()

    pathname.current = '/'
    rerender(<Breadcrumb />)
    expect(screen.queryByText('My toys')).not.toBeInTheDocument()
  })

  it('renders nothing on the account root', () => {
    pathname.current = '/dashboard'
    render(<Breadcrumb />)
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument()
  })
})
