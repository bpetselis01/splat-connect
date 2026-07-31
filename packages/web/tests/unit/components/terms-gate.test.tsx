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

  it('disables accept until the box is ticked when requireCheckbox is set', () => {
    render(<TermsGate type="contributor_terms" onAccepted={vi.fn()} requireCheckbox />)

    const button = screen.getByRole('button', { name: /I accept/i })
    expect(button).toBeDisabled()

    fireEvent.click(screen.getByRole('checkbox'))
    expect(button).toBeEnabled()
  })

  it('has no checkbox and an enabled button by default', () => {
    render(<TermsGate type="contributor_terms" onAccepted={vi.fn()} />)

    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.getByRole('button', { name: /I accept/i })).toBeEnabled()
  })

  it('mode="local" reports acceptance without calling the API', async () => {
    const onAccepted = vi.fn()
    render(<TermsGate type="contributor_terms" onAccepted={onAccepted} mode="local" />)

    fireEvent.click(screen.getByRole('button', { name: /I accept/i }))

    expect(post).not.toHaveBeenCalled()
    expect(onAccepted).toHaveBeenCalled()
  })

  it('renders a supplied content node instead of the default link line', () => {
    render(
      <TermsGate
        type="contributor_terms"
        onAccepted={vi.fn()}
        content={<p>Custom terms body</p>}
      />
    )

    expect(screen.getByText('Custom terms body')).toBeInTheDocument()
    expect(screen.queryByText(/please read the/i)).not.toBeInTheDocument()
  })

  it('keeps the default link line when no content is supplied', () => {
    render(<TermsGate type="contributor_terms" onAccepted={vi.fn()} />)
    expect(screen.getByText(/please read the/i)).toBeInTheDocument()
  })
})
