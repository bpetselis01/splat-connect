import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { BackLink } from '@/components/back-link'

const pathname = vi.hoisted(() => ({ current: '/tutorials/t1/edit' }))
const mockLink = vi.fn(
  ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
)
vi.mock('next/link', () => ({
  default: (props: { href: string; children: React.ReactNode; [key: string]: unknown }) => mockLink(props),
}))
vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }))

describe('BackLink', () => {
  beforeEach(() => {
    mockLink.mockClear()
    cleanup()
  })

  // Tests: the label alone is the accessible name — the arrow is decorative
  // Chain: "← My tutorials" read aloud is not an improvement on "My tutorials"
  it('names itself by its label, not its arrow', () => {
    render(<BackLink href="/dashboard/tutorials" label="My tutorials" />)
    const link = screen.getByRole('link', { name: 'My tutorials' })
    expect(link).toHaveAttribute('href', '/dashboard/tutorials')
  })

  // Tests: it is absent at desktop width, where the rail already carries the
  //        same destination as a row
  // Chain: the reason this component looks the way it does. Losing lg:hidden
  //        puts a duplicate of a rail row back on every one of these pages
  it('yields to the rail above lg', () => {
    render(<BackLink href="/dashboard/toys" label="My toys" />)
    expect(screen.getByRole('link', { name: 'My toys' })).toHaveClass('lg:hidden')
  })

  // Tests: it is drawn as a button, not as the tinted label it replaced
  // Chain: the whole point of the change — as `text-sm text-muted` it was the
  //        quietest thing on a page of buttons and pills, beside a rail that
  //        often carries the same destination as a full row
  it('is drawn as the quiet button', () => {
    render(<BackLink href="/dashboard/toys" label="My toys" />)
    const link = screen.getByRole('link', { name: 'My toys' })
    expect(link).toHaveClass('btn')
    expect(link).toHaveClass('btn-quiet')
  })

  // Tests: every hop inside the account section stays a soft transition
  // How:   from the editor to /dashboard and to /dashboard/tutorials
  // Chain: the rail was the only chrome split inside the account section, and
  //        it was retired on 2026-09-17 — the header is now identical on both
  //        ends of these hops, so forcing a full load would only cost a flash
  it('keeps every account-internal hop soft', () => {
    render(<BackLink href="/dashboard" label="My SPLAT" />)
    expect(mockLink.mock.calls.some((c) => c[0].href === '/dashboard')).toBe(true)
    cleanup()

    render(<BackLink href="/dashboard/tutorials" label="My tutorials" />)
    expect(mockLink.mock.calls.some((c) => c[0].href === '/dashboard/tutorials')).toBe(true)
  })
})
