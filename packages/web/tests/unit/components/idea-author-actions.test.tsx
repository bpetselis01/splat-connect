import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IdeaAuthorActions } from '@/components/idea-author-actions'
import { browserApiClient } from '@/lib/browser-api-client'

const refresh = vi.fn()
const toast = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/components/toast', () => ({ useToast: () => toast }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { delete: vi.fn() } }))

describe('IdeaAuthorActions', () => {
  it('withdraws a pending idea and says nothing was published', async () => {
    vi.mocked(browserApiClient.delete).mockResolvedValue(undefined)
    render(<IdeaAuthorActions id="i1" status="pending" />)
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw the idea' }))
    await waitFor(() => expect(browserApiClient.delete).toHaveBeenCalledWith('/api/ideas/i1'))
    expect(toast).toHaveBeenCalledWith('Withdrawn — nothing was published')
    expect(refresh).toHaveBeenCalled()
  })

  it('says so when the withdraw fails', async () => {
    vi.mocked(browserApiClient.delete).mockRejectedValue(new Error('409'))
    render(<IdeaAuthorActions id="i1" status="pending" />)
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw the idea' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not withdraw this idea. Please try again.')
  })

  it('offers a revised idea for a rejected one', () => {
    render(<IdeaAuthorActions id="i1" status="rejected" />)
    expect(screen.getByRole('link', { name: 'Submit a revised idea' }).getAttribute('href')).toBe(
      '/get-involved/submit-an-idea?from=i1'
    )
  })

  it('offers nothing on an idea that is public', () => {
    const { container } = render(<IdeaAuthorActions id="i1" status="challenge" />)
    expect(container).toBeEmptyDOMElement()
  })
})
