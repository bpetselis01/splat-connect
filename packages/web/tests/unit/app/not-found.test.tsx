import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import NotFound from '@/app/not-found'

vi.mock('next/navigation', () => ({ usePathname: () => '/nope' }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

describe('404 page', () => {
  it('says the page was not found and links back to the home page', () => {
    render(<NotFound />)
    expect(screen.getByRole('heading', { level: 1, name: "We couldn't find that page" })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to the home page' })).toHaveAttribute('href', '/')
  })
})
