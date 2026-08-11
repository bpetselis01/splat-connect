import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NewChildForm } from '@/components/new-child-form'
import { EditChildForm } from '@/components/edit-child-form'
import type { ChildProfile } from '@splat-connect/types'

const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }))
vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { post: vi.fn(), patch: vi.fn() },
}))

import { browserApiClient } from '@/lib/browser-api-client'

// Chain: ChildProfileForm's own tests mock onSave, so nothing else asserts
// that NewChildForm/EditChildForm actually wire it to the collection
// endpoint — this is the seam between the form and the API.
describe('NewChildForm', () => {
  beforeEach(() => vi.clearAllMocks())

  it('POSTs the edited fields to /api/child-profiles, then navigates to the list', async () => {
    vi.mocked(browserApiClient.post).mockResolvedValue({} as ChildProfile)
    render(<NewChildForm />)

    fireEvent.change(screen.getByLabelText('Age'), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByText('Saved')
    expect(browserApiClient.post).toHaveBeenCalledWith(
      '/api/child-profiles',
      expect.objectContaining({ age: 7 })
    )
    expect(push).toHaveBeenCalledWith('/dashboard/child')
  })

  // Known open gap: a failed create leaves the user on the form rather than
  // routing them away from data that was never saved.
  it('does not navigate away when the POST is rejected', async () => {
    vi.mocked(browserApiClient.post).mockRejectedValue(new Error('network'))
    render(<NewChildForm />)

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save your changes')
    expect(push).not.toHaveBeenCalled()
  })
})

describe('EditChildForm', () => {
  beforeEach(() => vi.clearAllMocks())

  it('PATCHes /api/child-profiles/<id> and stays on the page', async () => {
    vi.mocked(browserApiClient.patch).mockResolvedValue({} as ChildProfile)
    const child = { id: 'c1', age: 5 } as ChildProfile
    render(<EditChildForm child={child} />)

    fireEvent.change(screen.getByLabelText('Age'), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByText('Saved')
    expect(browserApiClient.patch).toHaveBeenCalledWith(
      '/api/child-profiles/c1',
      expect.objectContaining({ age: 9 })
    )
    expect(push).not.toHaveBeenCalled()
  })
})
