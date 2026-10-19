import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OrgThanksNotes } from '@/components/org-thanks-notes'
import { browserApiClient } from '@/lib/browser-api-client'
import type { OrgThanks } from '@splat-connect/types'

vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { patch: vi.fn() } }))

const note = (over: Partial<OrgThanks>) =>
  ({ profile_id: 'p1', note: 'You changed our Thursdays', byline: 'Hannah', show_note: true, hidden_at: null, created_at: '2026-10-01T00:00:00Z', ...over }) as OrgThanks

beforeEach(() => vi.clearAllMocks())

describe('OrgThanksNotes', () => {
  it('WB32 Hide patches hidden true for that family and relabels the note "Hidden" with a Show again button', async () => {
    vi.mocked(browserApiClient.patch).mockResolvedValue(note({ hidden_at: '2026-10-02T00:00:00Z' }))
    render(<OrgThanksNotes orgId="o1" thanks={[note({})]} />)
    expect(screen.getByText(/On your page/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }))
    await waitFor(() => expect(browserApiClient.patch).toHaveBeenCalledWith('/api/organizations/o1/thanks/p1', { hidden: true }))
    expect(await screen.findByRole('button', { name: 'Show again' })).toBeInTheDocument()
    expect(screen.getByText(/Hannah · .* · Hidden/)).toBeInTheDocument()
  })

  it('WB32 Show again patches hidden false, and a note kept just for the leader has no button', async () => {
    vi.mocked(browserApiClient.patch).mockResolvedValue(note({}))
    render(
      <OrgThanksNotes
        orgId="o1"
        thanks={[note({ hidden_at: '2026-10-02T00:00:00Z' }), note({ profile_id: 'p2', note: 'Private word', show_note: false })]}
      />,
    )
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByText(/Just for you/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show again' }))
    await waitFor(() => expect(browserApiClient.patch).toHaveBeenCalledWith('/api/organizations/o1/thanks/p1', { hidden: false }))
    expect(await screen.findByRole('button', { name: 'Hide' })).toBeInTheDocument()
  })
})
