import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const setActingOrg = vi.fn(async (_id: string) => {})
vi.mock('@/app/dashboard/organisation/acting-org-actions', () => ({ setActingOrg: (id: string) => setActingOrg(id) }))
import { ActingOrgSwitcher } from '@/components/acting-org-switcher'

const orgs = [
  { id: 'oA', name: 'Splat North', status: 'active' },
  { id: 'oB', name: 'Splat South', status: 'active' },
]

describe('ActingOrgSwitcher', () => {
  it('WB01 shows the current org and picks another', async () => {
    render(<ActingOrgSwitcher orgs={orgs} currentId="oA" />)
    fireEvent.click(screen.getByRole('button', { name: 'Acting for Splat North. Change organisation.' }))
    expect(screen.getByText(/follow the one you pick/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: /Splat South/ }))
    await waitFor(() => expect(setActingOrg).toHaveBeenCalledWith('oB'))
  })
})
