import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ToyTransactionRequest } from '@/components/toy-transaction-request'
import type { Toy, ToyWithOwner } from '@splat-connect/types'

// next/link only. The component stopped being a client component when the ask
// moved to its own screen — there is no router and no fetch left in it.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

function toy(overrides: Partial<ToyWithOwner> = {}): ToyWithOwner {
  return {
    id: 'toy-1',
    owner_id: 'owner-1',
    name: 'Fire truck',
    description: null,
    condition: 7,
    switch_adapted: false,
    photo_urls: ['https://test.supabase.co/storage/v1/object/public/photos/c.jpg'],
    cover_photo_url: 'https://test.supabase.co/storage/v1/object/public/photos/c.jpg',
    switch_photo_url: null,
    status: 'published',
    offer_type: 'both',
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    profiles: { name: 'Sam' },
    ...overrides,
  } as ToyWithOwner
}

function myToy(overrides: Partial<Toy> = {}): Toy {
  return {
    id: 'my-toy-1',
    owner_id: 'viewer-1',
    owner_org_id: null,
    quantity: 1,
    name: 'Blocks',
    description: null,
    condition: 8,
    switch_adapted: false,
    photo_urls: [],
    cover_photo_url: null,
    switch_photo_url: null,
    status: 'published',
    offer_type: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  }
}

describe('ToyTransactionRequest', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('prompts a signed-out visitor to sign in', () => {
    render(<ToyTransactionRequest toy={toy()} viewerId={null} myToys={[]} />)
    expect(screen.getByText(/sign in/i)).toBeInTheDocument()
  })

  it('shows nothing for the owner viewing their own toy', () => {
    const { container } = render(<ToyTransactionRequest toy={toy()} viewerId="owner-1" myToys={[]} />)
    expect(container.textContent).toBe('')
  })

  // Tests: the control is the way IN to asking, not the ask itself
  // How:   asserts the link and its destination for each offer_type
  // Chain: it used to post a transaction with no note at all. The artboard
  //        gives asking its own screen because the paragraph about the child is
  //        the part the whole exchange turns on — "a line or two about the
  //        child is what gets a yes" — and a two-button control had nowhere to
  //        put one
  it('links to the request screen rather than posting anything', () => {
    for (const offer of ['donation', 'exchange', 'both'] as const) {
      const { unmount } = render(
        <ToyTransactionRequest toy={toy({ offer_type: offer })} viewerId="viewer-1" myToys={[]} />
      )
      expect(screen.getByRole('link', { name: /ask for this toy/i })).toHaveAttribute(
        'href',
        '/toy-library/toy-1/request'
      )
      unmount()
    }
  })

  // Tests: a swap you cannot make is said out loud before you follow the link
  // Chain: the old control raised "Add a toy to My Toys" only after a click,
  //        which is a worse place to learn it
  it('says so when there is nothing to offer', () => {
    render(<ToyTransactionRequest toy={toy({ offer_type: 'exchange' })} viewerId="viewer-1" myToys={[]} />)
    expect(screen.getByText(/no listed toys to offer/i)).toBeInTheDocument()
  })

  it('says nothing about that when there is something to offer', () => {
    render(
      <ToyTransactionRequest toy={toy({ offer_type: 'exchange' })} viewerId="viewer-1" myToys={[myToy()]} />
    )
    expect(screen.queryByText(/no listed toys to offer/i)).not.toBeInTheDocument()
  })

  it('shows nothing when the toy is not offered at all', () => {
    render(<ToyTransactionRequest toy={toy({ offer_type: null })} viewerId="viewer-1" myToys={[]} />)
    expect(screen.getByText(/not currently offered/i)).toBeInTheDocument()
  })
})
