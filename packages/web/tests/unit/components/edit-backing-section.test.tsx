import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditBackingSection } from '@/components/edit-backing-section'
import { ToastProvider } from '@/components/toast'
import type { TutorialOrg, Organization } from '@splat-connect/types'

// The component calls router.refresh() after a successful write, because
// revalidatePath alone does not re-render a client component that invoked a
// server action.
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

const org = (id: string, name: string): Organization => ({
  id,
  name,
  description: `${name} description`,
  status: 'active',
  created_by: null,
  created_at: '',
  updated_at: '',
})

const row = (id: string, name: string, status: TutorialOrg['status']): TutorialOrg => ({
  id: `b-${id}`,
  tutorial_id: 't',
  org_id: id,
  status,
  requested_at: '',
  responded_at: null,
  responded_by: null,
  organizations: org(id, name),
})

const onAsk = vi.fn()
const onWithdraw = vi.fn()

const base = {
  tutorialStatus: 'pending' as const,
  reviewedForOrgId: null,
  organizations: [org('o1', 'Riverside'), org('o2', 'Northside')],
  onAsk,
  onWithdraw,
}

describe('EditBackingSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    onAsk.mockResolvedValue(undefined)
    onWithdraw.mockResolvedValue(undefined)
  })

  it('lists each organisation with its state', () => {
    render(<EditBackingSection {...base} backing={[row('o1', 'Riverside', 'pending')]} />)
    expect(screen.getByText('DECIDING')).toBeInTheDocument()
    expect(screen.getByText('Riverside')).toBeInTheDocument()
  })

  // Tests: the empty state teaches that asking is optional
  // How:   no backing rows; checks the copy names SPLAT and says "optional"
  // Chain: a contributor who asked nobody must not read the empty panel as a task
  //        they have failed to do — the platform reviews it either way
  it('says asking is optional when nothing has been asked', () => {
    render(<EditBackingSection {...base} backing={[]} />)
    expect(screen.getByText(/SPLAT will review it/i)).toBeInTheDocument()
    expect(screen.getByText(/optional/i)).toBeInTheDocument()
  })

  // Tests: the disclosure appears where the decision is made
  // How:   renders the section; checks the sentence is present
  // Chain: this is the contributor's only warning that offering a project exposes
  //        unpublished work, and it previously appeared once, in small grey text, in
  //        a wizard step they see only at submit
  it('states that leaders can read the draft while deciding', () => {
    render(<EditBackingSection {...base} backing={[]} />)
    expect(
      screen.getByText(/can read this while they decide, including if they say no/i)
    ).toBeInTheDocument()
  })

  it('offers only organisations that have not been asked', () => {
    render(<EditBackingSection {...base} backing={[row('o1', 'Riverside', 'pending')]} />)
    const options = screen.getAllByRole('option').map((o) => o.textContent).join(' ')
    expect(options).not.toContain('Riverside')
    expect(options).toContain('Northside')
  })

  it('withdraws a request that has not been acted on', async () => {
    render(<EditBackingSection {...base} backing={[row('o1', 'Riverside', 'pending')]} />)
    fireEvent.click(screen.getByRole('button', { name: /withdraw/i }))
    await waitFor(() => expect(onWithdraw).toHaveBeenCalledWith('o1'))
  })

  it('asks the chosen organisation', async () => {
    render(<EditBackingSection {...base} backing={[]} />)
    fireEvent.change(screen.getByLabelText(/Ask another organisation/i), {
      target: { value: 'o2' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^Ask$/ }))
    await waitFor(() => expect(onAsk).toHaveBeenCalledWith('o2'))
  })

  // Tests: a refusal is explained rather than hidden
  // How:   an approved tutorial whose reviewed_for_org_id is this org
  // Chain: hiding the control teaches nothing — the contributor needs to know the
  //        route out is asking SPLAT to unpublish, not that a button vanished
  it('explains why the approving organisation cannot be withdrawn', () => {
    render(
      <EditBackingSection
        {...base}
        tutorialStatus="approved"
        reviewedForOrgId="o1"
        backing={[row('o1', 'Riverside', 'accepted')]}
      />
    )
    expect(screen.getByText(/asking SPLAT to unpublish/i)).toBeInTheDocument()
  })

  // Tests: nothing is actionable once the tutorial is published
  // How:   approved status; checks the picker and both buttons are gone
  // Chain: every action is already refused by policy, and editing an approved
  //        tutorial resets it to pending — so controls here would offer buttons the
  //        database rejects, next to a keystroke that unpublishes the work
  it('is entirely read-only once the tutorial is approved', () => {
    render(
      <EditBackingSection
        {...base}
        tutorialStatus="approved"
        reviewedForOrgId="o1"
        backing={[row('o1', 'Riverside', 'accepted')]}
      />
    )
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /withdraw/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Ask$/ })).not.toBeInTheDocument()
  })

  // Tests: a failed write says so instead of appearing to succeed
  // How:   onWithdraw rejects; checks an alert appears
  // Chain: server actions fail silently by default, and a contributor who clicked
  //        Withdraw and saw nothing change would reasonably assume it worked
  it('surfaces a failed action', async () => {
    onWithdraw.mockRejectedValue(new Error('nope'))
    render(<EditBackingSection {...base} backing={[row('o1', 'Riverside', 'pending')]} />)
    fireEvent.click(screen.getByRole('button', { name: /withdraw/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })

  // Tests: a successful write refreshes the route
  // How:   withdraw resolves; checks router.refresh was called
  // Chain: revalidatePath marks the route stale but does not re-render the client
  //        component that called the action — without the refresh a contributor
  //        clicks, the write lands, and nothing visibly changes
  it('refreshes the page after a successful write', async () => {
    render(<EditBackingSection {...base} backing={[row('o1', 'Riverside', 'pending')]} />)
    fireEvent.click(screen.getByRole('button', { name: /withdraw/i }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('does not refresh when the write fails', async () => {
    onWithdraw.mockRejectedValue(new Error('nope'))
    render(<EditBackingSection {...base} backing={[row('o1', 'Riverside', 'pending')]} />)
    fireEvent.click(screen.getByRole('button', { name: /withdraw/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(refresh).not.toHaveBeenCalled()
  })

  it('fires the shared toast naming the organisation after Ask succeeds', async () => {
    render(
      <ToastProvider>
        <EditBackingSection {...base} backing={[]} />
      </ToastProvider>
    )
    fireEvent.change(screen.getByLabelText(/ask another organisation/i), { target: { value: 'o1' } })
    fireEvent.click(screen.getByText('Ask'))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Asked Riverside'))
  })

  it('fires the shared toast naming the organisation after Withdraw succeeds', async () => {
    render(
      <ToastProvider>
        <EditBackingSection {...base} backing={[row('o1', 'Riverside', 'pending')]} />
      </ToastProvider>
    )
    fireEvent.click(screen.getByText('Withdraw'))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Withdrew from Riverside'))
  })
})
