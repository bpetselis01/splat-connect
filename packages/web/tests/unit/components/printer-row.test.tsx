import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PrinterRow } from '@/components/printer-row'
import type { PrinterWithOwner } from '@splat-connect/types'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))
const patch = vi.fn()
const del = vi.fn()
vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { patch: (...a: unknown[]) => patch(...a), delete: (...a: unknown[]) => del(...a) },
}))

const printer = {
  id: 'pr-1', name: 'Prusa MK4', owner_id: 'me', owner_org_id: null, org_name: null, bed_x: 250, bed_y: 210, bed_z: 220,
  materials: ['PLA', 'PETG'], accepting: true, capacity: 2, open_jobs: 1, suburb: 'Ashfield', state: 'NSW', filament_cents_per_g: 4,
} as unknown as PrinterWithOwner

beforeEach(() => {
  vi.clearAllMocks()
  patch.mockResolvedValue({})
  del.mockResolvedValue({})
})

describe('PrinterRow', () => {
  it('WR23 pauses the printer, saying so at once, and PATCHes accepting false', async () => {
    render(<PrinterRow printer={printer} />)
    expect(screen.getByText('Open · 1 of 2 slots used')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Paused' }))
    expect(screen.getByText('Paused · not offered to anyone')).toBeInTheDocument()
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/printers/pr-1', { accepting: false }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('WR23 puts the toggle back and says so when the save fails', async () => {
    patch.mockRejectedValue(new Error('offline'))
    render(<PrinterRow printer={printer} />)
    fireEvent.click(screen.getByRole('button', { name: 'Paused' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('That did not save. Check your connection and try again.')
    expect(screen.getByRole('button', { name: 'Open' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('WR23 saves a changed Jobs at once only when it leaves the field with a new number', async () => {
    render(<PrinterRow printer={printer} />)
    const box = screen.getByLabelText('Jobs at once')
    fireEvent.blur(box)
    expect(patch).not.toHaveBeenCalled()
    fireEvent.change(box, { target: { value: '4' } })
    fireEvent.blur(box)
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/printers/pr-1', { capacity: 4 }))
  })

  it('WR24 removes the printer and refreshes the list', async () => {
    render(<PrinterRow printer={printer} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(del).toHaveBeenCalledWith('/api/printers/pr-1'))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('WR24 shows the API’s sentence when a job is still on the machine', async () => {
    del.mockRejectedValue(new Error('API DELETE /api/printers/pr-1 failed with status 409: {"error":"Finish or withdraw its jobs first."}'))
    render(<PrinterRow printer={printer} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Finish or withdraw its jobs first.')
    expect(refresh).not.toHaveBeenCalled()
  })
})
