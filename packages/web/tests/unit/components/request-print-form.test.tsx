import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { PrinterWithOwner } from '@splat-connect/types'
import { RequestPrintForm } from '@/components/request-print-form'
import { browserApiClient } from '@/lib/browser-api-client'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: vi.fn() } }))

const printer = (id: string, owner_name: string) =>
  ({ id, owner_name, org_name: null, name: 'Prusa MK4', materials: ['PETG'], suburb: null, state: null, accepting: true, capacity: 2, open_jobs: 0 }) as unknown as PrinterWithOwner

// Tests: the board's pick-up-to-three (074) — the fourth printer is disabled
//        once three are ticked, and the request carries every pick and the colour.
describe('RequestPrintForm', () => {
  it('asks up to three printers and sends them with the colour', async () => {
    const post = vi.mocked(browserApiClient.post).mockResolvedValue({ id: 'tx-1' })
    render(
      <RequestPrintForm
        tutorialId="t1"
        tutorialTitle="Switch mount"
        parts={[{ id: 'f1', filename: 'mount.stl', print_minutes: null, filament_grams: null, material: 'PETG' }]}
        printers={[printer('a', 'Ann'), printer('b', 'Bo'), printer('c', 'Cy'), printer('d', 'Di')]}
        header={<h1>Request a print</h1>}
      />
    )
    // The first open printer is preselected.
    expect(screen.getByText('1 of 3 picked · first to accept wins')).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: /Bo/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Cy/ }))
    expect(screen.getByText('3 of 3 picked · first to accept wins')).toBeTruthy()
    expect((screen.getByRole('checkbox', { name: /Di/ }) as HTMLInputElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: /Black/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /I understand/ }))
    fireEvent.click(screen.getByRole('button', { name: /Send request/ }))
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/toy-transactions/print', {
        tutorial_id: 't1',
        printer_ids: ['a', 'b', 'c'],
        stl_file_ids: ['f1'],
        colour: 'Black',
        note: '',
      })
    )
  })
})
