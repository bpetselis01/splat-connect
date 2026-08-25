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

  it('links back to the section on a page inside it', () => {
    pathname.current = '/get-involved/submit-an-idea'
    render(<Breadcrumb />)
    expect(screen.getByRole('link', { name: /Get Involved/ })).toHaveAttribute('href', '/get-involved')
  })

  it('picks up a soft navigation to a page with no section', () => {
    pathname.current = '/get-involved/submit-an-idea'
    const { rerender } = render(<Breadcrumb />)
    expect(screen.getByText('Get Involved')).toBeInTheDocument()

    pathname.current = '/'
    rerender(<Breadcrumb />)
    expect(screen.queryByText('Get Involved')).not.toBeInTheDocument()
  })
})
