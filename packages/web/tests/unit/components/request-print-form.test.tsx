import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
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
        files: [{ stl_file_id: 'f1', quantity: 1 }],
        colour: 'Black',
        note: '',
      })
    )
  })

  it('sends the customization answers, and a second tap clears one', async () => {
    const post = vi.mocked(browserApiClient.post).mockResolvedValue({ id: 'tx-3' })
    render(
      <RequestPrintForm
        tutorialId="t1"
        tutorialTitle="Switch mount"
        parts={[{ id: 'f1', filename: 'mount.stl', print_minutes: null, filament_grams: null, material: 'PETG' }]}
        printers={[printer('a', 'Ann')]}
        header={<h1>Request a print</h1>}
      />
    )
    const answer = (question: string, option: string) =>
      fireEvent.click(within(screen.getByRole('group', { name: question })).getByRole('button', { name: option }))
    answer('Reach from seated', '20–40 cm')
    answer('Mount needed', 'Floor stand')
    answer('Tray thickness', '15 mm')
    answer('Tray thickness', '15 mm')
    fireEvent.click(screen.getByRole('checkbox', { name: /I understand/ }))
    fireEvent.click(screen.getByRole('button', { name: /Send request/ }))
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/api/toy-transactions/print',
        expect.objectContaining({ fit_notes: { reach: '20–40 cm', mount: 'Floor stand' } })
      )
    )
  })

  it('sends a quantity per part', async () => {
    const post = vi.mocked(browserApiClient.post).mockResolvedValue({ id: 'tx-2' })
    render(
      <RequestPrintForm
        tutorialId="t1"
        tutorialTitle="Switch mount"
        parts={[{ id: 'f1', filename: 'mount.stl', print_minutes: null, filament_grams: null, material: 'PETG' }]}
        printers={[printer('a', 'Ann')]}
        header={<h1>Request a print</h1>}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'More mount.stl' }))
    fireEvent.click(screen.getByRole('checkbox', { name: /I understand/ }))
    fireEvent.click(screen.getByRole('button', { name: /Send request/ }))
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/toy-transactions/print', expect.objectContaining({ files: [{ stl_file_id: 'f1', quantity: 2 }] }))
    )
  })

  // Tests: 097 — the bed check runs over the ticked parts only, so an oversized
  //        part the family leaves out does not hide a small printer
  it('hides a printer only for the parts that are ticked', async () => {
    const post = vi.mocked(browserApiClient.post).mockResolvedValue({ id: 'tx-3' })
    const small = { ...printer('s', 'Sam'), bed_x: 180, bed_y: 180, bed_z: 180 } as PrinterWithOwner
    const sized = { print_minutes: null, filament_grams: null, material: 'PETG' as const }
    render(
      <RequestPrintForm
        tutorialId="t1"
        tutorialTitle="Switch mount"
        parts={[
          { id: 'f1', filename: 'mount.stl', ...sized, size_x_mm: 50, size_y_mm: 50, size_z_mm: 50 },
          { id: 'f2', filename: 'tray.stl', ...sized, size_x_mm: 300, size_y_mm: 50, size_z_mm: 20 },
        ]}
        printers={[small]}
        header={<h1>Request a print</h1>}
      />
    )
    expect(screen.queryByRole('checkbox', { name: /Sam/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Include tray.stl' }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Sam/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /I understand/ }))
    fireEvent.click(screen.getByRole('button', { name: /Send request/ }))
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/toy-transactions/print', expect.objectContaining({ printer_ids: ['s'] }))
    )

    // Ticking the tray again takes Sam off the list and out of the request.
    fireEvent.click(screen.getByRole('button', { name: 'Include tray.stl' }))
    expect(screen.queryByRole('checkbox', { name: /Sam/ })).toBeNull()
    expect(screen.getByText('Pick up to three printers')).toBeTruthy()
  })

  // Tests: 097 — a listed printer the bed check hides is not "nobody has listed"
  it('says no printer matches when the only one is too small', () => {
    const small = { ...printer('s', 'Sam'), bed_x: 100, bed_y: 100, bed_z: 100 } as PrinterWithOwner
    render(
      <RequestPrintForm
        tutorialId="t1"
        tutorialTitle="Switch mount"
        parts={[{ id: 'f1', filename: 'tray.stl', print_minutes: null, filament_grams: null, material: 'PETG', size_x_mm: 300, size_y_mm: 50, size_z_mm: 20 }]}
        printers={[small]}
        header={<h1>Request a print</h1>}
      />
    )
    expect(screen.getByText('No printer matches.')).toBeTruthy()
    expect(screen.queryByText('Nobody has listed a printer yet.')).toBeNull()
  })
})

