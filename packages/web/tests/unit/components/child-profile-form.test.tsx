import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChildProfileForm } from '@/components/child-profile-form'
import type { ChildProfile } from '@splat-connect/types'

const put = vi.fn()
vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { put: (...args: unknown[]) => put(...args) },
}))

describe('ChildProfileForm', () => {
  // Chain: gating the tab on isParent would mean the only way to create a child
  //        profile is to already have one. This is the create path.
  it('lets an account with no child profile create one', async () => {
    put.mockResolvedValue({ parent_id: 'u1', age: 7 })
    render(<ChildProfileForm profile={null} />)

    fireEvent.change(screen.getByLabelText('Age'), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    // Wait for the save to fully settle (not just for `put` to have been called) so
    // no in-flight promise from this test resolves mid-way through the next one.
    await screen.findByText('Saved')
    expect(put).toHaveBeenCalledWith('/api/child-profile', expect.objectContaining({ age: 7 }))
  })

  it('pre-fills an existing profile', () => {
    render(
      <ChildProfileForm
        profile={{ age: 9, primary_diagnosis: 'Cerebral palsy', macs_level: 'II' } as ChildProfile}
      />
    )
    expect(screen.getByLabelText('Age')).toHaveValue(9)
    expect(screen.getByLabelText('Primary diagnosis')).toHaveValue('Cerebral palsy')
  })

  it('saves the ability fields', async () => {
    put.mockResolvedValue({})
    render(<ChildProfileForm profile={null} />)

    fireEvent.change(screen.getByLabelText('MACS level'), { target: { value: 'III' } })
    fireEvent.change(screen.getByLabelText('Hand involvement'), { target: { value: 'unilateral' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByText('Saved')
    expect(put).toHaveBeenCalledWith(
      '/api/child-profile',
      expect.objectContaining({ macs_level: 'III', hand_involvement: 'unilateral' })
    )
  })

  it('reports a failed save instead of claiming success', async () => {
    put.mockRejectedValue(new Error('boom'))
    render(<ChildProfileForm profile={null} />)

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not save/i)
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })
})
