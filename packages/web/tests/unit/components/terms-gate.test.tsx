import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { TermsGate } from '@/components/terms-gate'

const post = vi.fn()
vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { post: (...a: unknown[]) => post(...a) },
}))

describe('TermsGate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('records the acceptance and reports it upward', async () => {
    post.mockResolvedValue({})
    const onAccepted = vi.fn()
    render(<TermsGate type="contributor_terms" onAccepted={onAccepted} />)

    fireEvent.click(screen.getByRole('button', { name: /I accept/i }))

    expect(post).toHaveBeenCalledWith('/api/agreements', { agreement_type: 'contributor_terms' })
    await waitFor(() => expect(onAccepted).toHaveBeenCalled())
  })

  it('does not report acceptance when the call fails', async () => {
    // The gate must not let the UI believe an acceptance was recorded when the
    // server never recorded one — the API would then 403 the actual submit and the
    // user would have no idea why.
    post.mockRejectedValue(new Error('nope'))
    const onAccepted = vi.fn()
    render(<TermsGate type="org_leader_terms" onAccepted={onAccepted} />)

    fireEvent.click(screen.getByRole('button', { name: /I accept/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(onAccepted).not.toHaveBeenCalled()
  })

  it('links to the right document per type', () => {
    render(<TermsGate type="org_leader_terms" onAccepted={vi.fn()} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/legal/org-leader-terms')
  })
})
