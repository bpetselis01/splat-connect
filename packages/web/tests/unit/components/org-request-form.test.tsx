import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { OrgRequestForm } from '@/components/org-request-form'
import { browserApiClient } from '@/lib/browser-api-client'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: vi.fn() } }))
const post = vi.mocked(browserApiClient.post)

function fill() {
  fireEvent.change(screen.getByLabelText('Organisation name'), { target: { value: 'Eastside Therapy' } })
  fireEvent.change(screen.getByLabelText('What it does'), { target: { value: 'Paediatric OT, twelve therapists.' } })
  fireEvent.change(screen.getByLabelText('How we can check you work there'), {
    target: { value: 'My work email is on eastside.example.' },
  })
}

describe('OrgRequestForm', () => {
  beforeEach(() => vi.clearAllMocks())

  it('WI08 posts the three answers, says it was sent and refreshes the page', async () => {
    post.mockResolvedValue({})
    render(<OrgRequestForm existing={[]} />)
    fill()
    fireEvent.click(screen.getByRole('button', { name: 'Send for verification' }))
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/organizations/requests', {
        org_name: 'Eastside Therapy',
        what_they_do: 'Paediatric OT, twelve therapists.',
        verification: 'My work email is on eastside.example.',
      })
    )
    expect(await screen.findByRole('status')).toHaveTextContent('Sent. An admin reviews every request before an organisation is created.')
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('WI08 shows the server sentence when a second open ask for the same name is refused', async () => {
    post.mockRejectedValue(new Error('409 {"error":"You already asked for this organisation."}'))
    render(<OrgRequestForm existing={[]} />)
    fill()
    fireEvent.click(screen.getByRole('button', { name: 'Send for verification' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('You already asked for this organisation.')
  })

  it('WI08 replaces the form with "Sent for verification" while a request is pending', () => {
    render(
      <OrgRequestForm
        existing={[
          { id: 'r1', org_name: 'Eastside Therapy', status: 'pending', review_note: null, organization_id: null } as never,
        ]}
      />
    )
    expect(screen.getByRole('heading', { name: 'Sent for verification' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Send for verification' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Go to My SPLAT' })).toHaveAttribute('href', '/dashboard')
  })
})
