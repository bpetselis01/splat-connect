import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { PrinterWithOwner } from '@splat-connect/types'
import { PrinterDirectory } from '@/components/printer-directory'

const base: PrinterWithOwner = {
  id: 'p1',
  owner_id: 'u1',
  owner_org_id: null,
  name: 'Prusa MK4',
  materials: ['PLA', 'PETG'],
  bed_x: 250,
  bed_y: 210,
  bed_z: 220,
  suburb: 'Newtown',
  state: 'NSW',
  accepting: true,
  capacity: 2,
  notes: null,
  filament_cents_per_g: null,
  rate_note: null,
  created_at: '',
  updated_at: '',
  owner_name: 'Sam Printer',
  org_name: null,
  open_jobs: 0,
}

const printers: PrinterWithOwner[] = [
  base,
  {
    ...base,
    id: 'p2',
    owner_id: null,
    owner_org_id: 'o1',
    org_name: 'Library One',
    owner_name: null,
    materials: ['TPU'],
    open_jobs: 2,
  },
]

describe('PrinterDirectory', () => {
  it('shows the gate, not an empty grid, to a guest', () => {
    render(<PrinterDirectory printers={null} gate={<p>Sign in to ask for a print</p>} />)
    expect(screen.getByText('Sign in to ask for a print')).toBeInTheDocument()
    expect(screen.queryByText(/printers?$/)).not.toBeInTheDocument()
  })

  // A full machine is shown and marked, not hidden — until somebody asks for
  // open ones only.
  it('filters on what a printer row stores', () => {
    render(<PrinterDirectory printers={printers} gate={null} />)
    expect(screen.getByText('2 printers')).toBeInTheDocument()
    expect(screen.getByText('Not taking requests right now')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open now' }))
    expect(screen.getByText('1 printer')).toBeInTheDocument()
    expect(screen.queryByText('Library One')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    fireEvent.click(screen.getByRole('button', { name: 'An organisation' }))
    expect(screen.getByText('Library One')).toBeInTheDocument()
    expect(screen.queryByText('Sam Printer')).not.toBeInTheDocument()
  })

  it('filters by the distance from you', () => {
    render(
      <PrinterDirectory
        printers={[{ ...base, id: 'n', owner_name: 'Near Nell', km: 3 }, { ...base, id: 'f', owner_name: 'Far Fred', km: 30 }]}
        gate={null}
        hasPostcode
      />
    )
    expect(screen.getByText(/3 km/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Within 5 km' }))
    expect(screen.queryByText('Far Fred')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Within 25 km' }))
    expect(screen.queryByText('Far Fred')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Anywhere' }))
    expect(screen.getByText('Far Fred')).toBeInTheDocument()
  })

  it('asks for a postcode when the profile has none', () => {
    render(<PrinterDirectory printers={printers} gate={null} />)
    expect(screen.getByRole('link', { name: 'Add your postcode' })).toHaveAttribute('href', '/dashboard/profile')
  })

  it('offers no distance to a guest', () => {
    render(<PrinterDirectory printers={null} gate={null} />)
    expect(screen.queryByText('Distance from you')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Add your postcode' })).toBeNull()
  })

  it('shows no km for a printer with no distance', () => {
    render(<PrinterDirectory printers={[{ ...base, km: null }]} gate={null} hasPostcode />)
    expect(screen.queryByText(/· \d+ km/)).toBeNull()
  })
})
