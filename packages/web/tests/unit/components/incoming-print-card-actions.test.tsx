import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { IncomingPrintCard } from '@/components/incoming-print-card'
import type { ToyTransactionSummary } from '@splat-connect/types'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))
const post = vi.fn()
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: (...a: unknown[]) => post(...a) } }))

const tx = {
  id: 'tx-9', type: 'print', status: 'requested', owner_org_id: null, created_at: new Date().toISOString(),
  tutorial_title: 'Switch mount', print_note: null, print_group_id: null, print_colour: null, print_delivery: null,
  requester_suburb: null, part_sets: null, blocked_by_rival_accept: false, print_files: [],
} as unknown as ToyTransactionSummary

const ADDRESS = { pickup_line1: '9 Bench St', pickup_suburb: 'Testville', pickup_state: 'VIC', pickup_postcode: '3000' }

beforeEach(() => {
  vi.clearAllMocks()
  post.mockResolvedValue({})
})

describe('IncomingPrintCard actions', () => {
  it('WR25 asks a personal printer where to collect, then accepts with that address and refreshes', async () => {
    render(<IncomingPrintCard tx={tx} defaultAddress={ADDRESS} />)
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    expect(post).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /accept request/i }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/toy-transactions/tx-9/accept', ADDRESS))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('WR25 accepts an organisation’s job outright with an empty body', async () => {
    render(<IncomingPrintCard tx={{ ...tx, owner_org_id: 'org-1' } as ToyTransactionSummary} defaultAddress={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/toy-transactions/tx-9/accept', {}))
  })

  it('WR26 opens the reasons on Decline and sends the one picked', async () => {
    render(<IncomingPrintCard tx={tx} defaultAddress={null} />)
    fireEvent.click(screen.getByRole('button', { name: /Decline/ }))
    expect(screen.getByText('Why? The requester sees the reason.')).toBeInTheDocument()
    expect(post).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Too big for my bed' }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/toy-transactions/tx-9/reject', { reason: 'Too big for my bed' }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('WR26 says the decline did not go through, and does not refresh, when the post fails', async () => {
    post.mockRejectedValue(new Error('offline'))
    render(<IncomingPrintCard tx={tx} defaultAddress={null} />)
    fireEvent.click(screen.getByRole('button', { name: /Decline/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Away for a while' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('That did not go through. Check your connection and try again.')
    expect(refresh).not.toHaveBeenCalled()
  })
})
