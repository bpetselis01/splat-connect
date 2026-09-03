import { describe, it, expect, vi, beforeEach } from 'vitest'
// fireEvent, not user-event: @testing-library/user-event is not a dependency
// of this package and the no-new-dependencies constraint applies to tests too.
import { render, screen, fireEvent } from '@testing-library/react'
import { ToyTransactionRequest } from '@/components/toy-transaction-request'
import { browserApiClient } from '@/lib/browser-api-client'
import type { Toy, ToyWithOwner } from '@splat-connect/types'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

function toy(overrides: Partial<ToyWithOwner> = {}): ToyWithOwner {
  return {
    id: 'toy-1',
    owner_id: 'owner-1',
    name: 'Fire truck',
    description: null,
    condition: 7,
    switch_adapted: false,
    photo_urls: ['https://example.com/c.jpg'],
    cover_photo_url: 'https://example.com/c.jpg',
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

  it('starts a donation request', async () => {
    const post = vi.spyOn(browserApiClient, 'post').mockResolvedValue({ id: 'tx-1' })
    render(<ToyTransactionRequest toy={toy({ offer_type: 'donation' })} viewerId="viewer-1" myToys={[]} />)

    fireEvent.click(screen.getByRole('button', { name: /arrange pickup/i }))

    expect(post).toHaveBeenCalledWith('/api/toy-transactions', { toy_id: 'toy-1', type: 'donation' })
  })

  it('prompts to add a toy before exchanging when My Toys is empty', async () => {
    render(<ToyTransactionRequest toy={toy({ offer_type: 'exchange' })} viewerId="viewer-1" myToys={[]} />)

    fireEvent.click(screen.getByRole('button', { name: /arrange exchange/i }))

    expect(screen.getByText(/add a toy/i)).toBeInTheDocument()
  })

  it('starts an exchange with a chosen toy', async () => {
    const post = vi.spyOn(browserApiClient, 'post').mockResolvedValue({ id: 'tx-1' })
    render(<ToyTransactionRequest toy={toy({ offer_type: 'exchange' })} viewerId="viewer-1" myToys={[myToy()]} />)

    fireEvent.click(screen.getByRole('button', { name: /arrange exchange/i }))
    fireEvent.change(screen.getByLabelText(/offer one of your toys/i), { target: { value: 'my-toy-1' } })
    fireEvent.click(screen.getByRole('button', { name: /start exchange/i }))

    expect(post).toHaveBeenCalledWith('/api/toy-transactions', { toy_id: 'toy-1', type: 'exchange', offered_toy_id: 'my-toy-1' })
  })
})
