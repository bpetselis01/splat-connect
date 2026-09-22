import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IncomingPrintCard } from '@/components/incoming-print-card'
import type { ToyTransactionSummary } from '@splat-connect/types'

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
  print_note: null,
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
