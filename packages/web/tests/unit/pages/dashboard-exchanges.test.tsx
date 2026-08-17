import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ExchangesPage from '@/app/dashboard/exchanges/page'
import type { ToyTransactionSummary } from '@splat-connect/types'

vi.mock('@/lib/capabilities', () => ({
  getCapabilities: async () => ({
    profile: { id: 'owner-1', name: 'Sam', email: 'sam@example.com', role: 'contributor' },
    isAdmin: false,
    ledOrgs: [],
    canAuthor: true,
    unreadNotifications: 0,
    exchangeActions: 1,
  }),
}))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn() } }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))

import { apiClient } from '@/lib/api-client'

function tx(overrides: Partial<ToyTransactionSummary> = {}): ToyTransactionSummary {
  return {
    id: 'tx-1',
    toy_id: 'toy-1',
    offered_toy_id: null,
    type: 'donation',
    status: 'requested',
    requester_id: 'requester-1',
    owner_id: 'owner-1',
    owner_code: null,
    requester_code: null,
    owner_confirmed_at: null,
    requester_confirmed_at: null,
    pickup_line1: null,
    pickup_suburb: null,
    pickup_state: null,
    pickup_postcode: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    toy_name: 'Fire truck',
    offered_toy_name: null,
    other_party_name: 'Ash',
    blocked_by_rival_accept: false,
    last_message: null,
    ...overrides,
  }
}

describe('ExchangesPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('tells the owner an open request is waiting on them', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([tx()])
    render(await ExchangesPage())
    expect(screen.getByText(/waiting on you — accept or decline/i)).toBeInTheDocument()
  })

  it('asks for a handoff confirmation once accepted', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([tx({ status: 'accepted' })])
    render(await ExchangesPage())
    expect(screen.getByText(/waiting on you — confirm the handoff/i)).toBeInTheDocument()
  })

  it('says nothing is waiting when the other party holds the next move', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([tx({ owner_id: 'someone-else' })])
    render(await ExchangesPage())
    expect(screen.queryByText(/waiting on you/i)).not.toBeInTheDocument()
  })

  it('does not nag about a request the owner is locked out of accepting', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([tx({ blocked_by_rival_accept: true })])
    render(await ExchangesPage())
    expect(screen.queryByText(/waiting on you/i)).not.toBeInTheDocument()
    expect(screen.getByText(/locked — another request accepted/i)).toBeInTheDocument()
  })

  it('previews the newest message, crediting the other party by omission', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([
      tx({
        last_message: {
          body: 'Is it still available?',
          sender_id: 'requester-1',
          kind: 'user',
          created_at: '2026-08-02T00:00:00Z',
        },
      }),
    ])
    render(await ExchangesPage())
    expect(screen.getByText('Is it still available?')).toBeInTheDocument()
    expect(screen.queryByText(/^You: /)).not.toBeInTheDocument()
  })

  it('prefixes the preview with "You:" when the viewer sent it', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([
      tx({
        last_message: {
          body: 'Yes, come by Saturday.',
          sender_id: 'owner-1',
          kind: 'user',
          created_at: '2026-08-02T00:00:00Z',
        },
      }),
    ])
    render(await ExchangesPage())
    expect(screen.getByText(/You:/)).toBeInTheDocument()
    expect(screen.getByText(/Yes, come by Saturday\./)).toBeInTheDocument()
  })

  it('shows a system line unprefixed, since nobody typed it', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([
      tx({
        last_message: {
          body: 'Request accepted. Pickup details are ready below.',
          sender_id: 'owner-1',
          kind: 'system',
          created_at: '2026-08-02T00:00:00Z',
        },
      }),
    ])
    render(await ExchangesPage())
    expect(screen.queryByText(/You:/)).not.toBeInTheDocument()
    expect(screen.getByText(/Request accepted/)).toBeInTheDocument()
  })

  it('falls back to the empty state with no transactions', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([])
    render(await ExchangesPage())
    expect(screen.getByText(/no donation or exchange requests yet/i)).toBeInTheDocument()
  })
})
