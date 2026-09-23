import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { IncomingPrintCard } from '@/components/incoming-print-card'
import { browserApiClient } from '@/lib/browser-api-client'
import type { PrinterWithOwner, ToyTransactionSummary } from '@splat-connect/types'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: vi.fn() } }))

const tx = {
  id: 'tx-1',
  type: 'print',
  status: 'requested',
  owner_org_id: null,
  created_at: new Date().toISOString(),
  tutorial_title: 'Switch mount, printable',
  print_note: null, print_group_id: null, print_colour: null, print_delivery: null,
  requester_suburb: null,
  part_sets: null,
  blocked_by_rival_accept: false,
  print_files: [
    { id: 'f1', filename: 'switch-mount-body.stl', quantity: 1, print_minutes: 100, filament_grams: 20, material: 'PETG' },
    { id: 'f2', filename: 'cradle-65mm.stl', quantity: 2, print_minutes: 45, filament_grams: 10, material: 'PETG' },
  ],
} as unknown as ToyTransactionSummary

// Tests: the board's file line and its two settings chips, summed over the parts
//        with their quantities (068). A job with no files draws neither.
describe('IncomingPrintCard', () => {
  it('draws the file line and the summed settings chips', () => {
    render(<IncomingPrintCard tx={tx} defaultAddress={null} />)
    expect(screen.getByText('switch-mount-body.stl, cradle-65mm.stl × 2')).toBeTruthy()
    expect(screen.getByText('3 h 10 min')).toBeTruthy()
    expect(screen.getByText('40 g PETG')).toBeTruthy()
  })

  it('draws nothing of that on a job without files', () => {
    render(<IncomingPrintCard tx={{ ...tx, print_files: [] }} defaultAddress={null} />)
    expect(screen.queryByText(/\.stl/)).toBeNull()
    expect(screen.queryByText(/min$/)).toBeNull()
  })
})

// Tests: a request sent to several printers (074) — the "others asked" line, the
//        organisation's machine picker preselecting the bench that fits, and a
//        lost race reading as the API's sentence.
describe('IncomingPrintCard, grouped requests', () => {
  const machine = (id: string, name: string, over: Partial<PrinterWithOwner> = {}) =>
    ({ id, name, owner_org_id: 'o1', materials: ['PETG'], accepting: true, capacity: 2, open_jobs: 0, ...over }) as PrinterWithOwner
  const orgTx = { ...tx, owner_org_id: 'o1', print_group_id: 'g1', print_group_size: 3 }

  it('says how many others were asked', () => {
    render(<IncomingPrintCard tx={orgTx} defaultAddress={null} />)
    expect(screen.getByText('2 other printers were asked — first to accept wins')).toBeTruthy()
  })

  it('preselects the machine that fits and accepts onto the one chosen', async () => {
    const post = vi.mocked(browserApiClient.post).mockResolvedValue({})
    const machines = [machine('x1c', 'Bambu X1C', { materials: ['PLA'] }), machine('mk4', 'Prusa MK4')]
    render(<IncomingPrintCard tx={orgTx} defaultAddress={null} machines={machines} />)
    expect(screen.getByRole('radio', { name: /Prusa MK4/ }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByRole('radio', { name: /Bambu X1C/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Accept anyway on Bambu X1C' }))
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/toy-transactions/tx-1/accept', { printer_id: 'x1c' })
    )
  })

  it('draws no picker for a single machine', () => {
    render(<IncomingPrintCard tx={orgTx} defaultAddress={null} machines={[machine('mk4', 'Prusa MK4')]} />)
    expect(screen.queryByRole('radiogroup')).toBeNull()
    expect(screen.getByRole('button', { name: 'Accept' })).toBeTruthy()
  })

  it('shows the already-taken sentence when another printer won', async () => {
    const err = Object.assign(
      new Error(
        'API POST /api/toy-transactions/tx-1/accept failed with status 409: Another printer has already taken this job.'
      ),
      { status: 409 }
    )
    vi.mocked(browserApiClient.post).mockRejectedValue(err)
    render(<IncomingPrintCard tx={orgTx} defaultAddress={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    expect(await screen.findByText('Another printer has already taken this job.')).toBeTruthy()
  })
})
