import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ToyLibraryCard } from '@/components/toy-library-card'
import type { ToyWithOwner } from '@splat-connect/types'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />
  ),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/toy-library',
}))

const toy = {
  id: 'toy-1',
  name: 'Pop-up pals',
  condition: 8,
  status: 'published',
  switch_adapted: true,
  quantity: 1,
  owner_id: 'someone',
  owner_org_id: null,
  photo_urls: ['https://example.com/toy.jpg'],
  cover_photo_url: 'https://example.com/toy.jpg',
} as unknown as ToyWithOwner

describe('ToyLibraryCard', () => {
  it('links to the toy detail page', () => {
    render(<ToyLibraryCard toy={toy} />)
    expect(screen.getByTestId('toy-library-card')).toHaveAttribute('href', '/toy-library/toy-1')
  })

  /**
   * Default-off is the assertion that matters: this card renders on pages that
   * show your own listings too, where a save button reads as a bug. Keeping
   * those correct by DOING NOTHING beats remembering to switch something off.
   */
  it('renders no control and no wrapper when save is omitted', () => {
    const { container } = render(<ToyLibraryCard toy={toy} />)
    expect(container.querySelector('.save-host')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(container.firstElementChild).toHaveAttribute('data-testid', 'toy-library-card')
  })

  it('renders the control as a sibling of the card link when save is given', () => {
    const { container } = render(
      <ToyLibraryCard toy={toy} save={{ slug: 'toys', id: toy.id, saved: false, signedIn: true }} />
    )
    const host = container.querySelector('.save-host')
    expect(host).not.toBeNull()

    // A <button> inside an <a> is invalid HTML with an ambiguous click target.
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button.closest('a')).toBeNull()
    expect(host!.querySelector('a')).not.toBeNull()
  })
})
