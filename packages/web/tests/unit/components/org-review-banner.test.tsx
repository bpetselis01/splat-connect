import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { OrgReviewBanner } from '@/components/org-review-banner'
import { browserApiClient } from '@/lib/browser-api-client'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: vi.fn() } }))
const post = vi.mocked(browserApiClient.post)

beforeEach(() => vi.clearAllMocks())

describe('OrgReviewBanner', () => {
  it('WN05 records the organisation leader terms, hides the banner and refreshes the page', async () => {
    post.mockResolvedValue({})
    render(<OrgReviewBanner />)
    expect(screen.getByRole('heading', { name: 'Accept the leader terms to review' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /I accept/i }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/agreements', { agreement_type: 'org_leader_terms' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Accept the leader terms to review' })).toBeNull())
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('WN05 keeps the banner and says so when the acceptance is not recorded', async () => {
    post.mockRejectedValue(new Error('nope'))
    render(<OrgReviewBanner />)
    fireEvent.click(screen.getByRole('button', { name: /I accept/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not record your acceptance. Please try again.')
    expect(screen.getByRole('heading', { name: 'Accept the leader terms to review' })).toBeInTheDocument()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('WN05 opens the same acceptance from the queue strip\'s Read and accept', async () => {
    post.mockResolvedValue({})
    render(<OrgReviewBanner variant="strip" />)
    expect(screen.queryByRole('button', { name: /I accept/i })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Read and accept' }))
    fireEvent.click(screen.getByRole('button', { name: /I accept/i }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/agreements', { agreement_type: 'org_leader_terms' }))
  })
})
