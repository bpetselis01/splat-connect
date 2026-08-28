import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NotificationsList } from '@/components/notifications-list'
import type { Notification } from '@splat-connect/types'

// run() calls router.refresh() after a successful action, so useRouter needs
// a mock outside Next's app router context (same as EditBackingSection's test).
const mockRefresh = vi.fn()
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mockRefresh, push: mockPush }) }))

function baseNotif(overrides?: Partial<Notification>): Notification {
  return {
    id: 'n1',
    recipient_id: 'u1',
    type: 'tutorial_approved',
    tutorial_id: 't1',
    actor_name: 'SPLAT',
    read_at: null,
    created_at: new Date().toISOString(),
    tutorial_title: 'Spoon Holder',
    ...overrides,
  }
}

describe('NotificationsList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a notification and marks it read on click', async () => {
    const onMarkRead = vi.fn().mockResolvedValue(undefined)
    render(
      <NotificationsList
        notifications={[baseNotif()]}
        pendingInvitesByTutorial={{}}
        onMarkRead={onMarkRead}
        onAcceptInvite={vi.fn()}
        onDeclineInvite={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText(/Spoon Holder/))
    await waitFor(() => expect(onMarkRead).toHaveBeenCalledWith('n1'))
  })

  it('renders Accept/Decline for a pending invite notification', async () => {
    const inviteNotif = baseNotif({ id: 'n2', type: 'collaborator_invited' })
    const onAcceptInvite = vi.fn().mockResolvedValue(undefined)
    render(
      <NotificationsList
        notifications={[inviteNotif]}
        pendingInvitesByTutorial={{ t1: 'invite-1' }}
        onMarkRead={vi.fn()}
        onAcceptInvite={onAcceptInvite}
        onDeclineInvite={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('Accept'))
    await waitFor(() => expect(onAcceptInvite).toHaveBeenCalledWith('invite-1'))
  })

  it('shows no Accept/Decline once the invite is no longer pending', () => {
    const inviteNotif = baseNotif({ id: 'n3', type: 'collaborator_invited' })
    render(
      <NotificationsList
        notifications={[inviteNotif]}
        pendingInvitesByTutorial={{}}
        onMarkRead={vi.fn()}
        onAcceptInvite={vi.fn()}
        onDeclineInvite={vi.fn()}
      />
    )
    expect(screen.queryByText('Accept')).not.toBeInTheDocument()
  })

  it('shows toy-specific copy for a toy_request notification', () => {
    render(<NotificationsList notifications={[baseNotif({ type: 'toy_request', tutorial_id: null, tutorial_title: null, toy_transaction_id: 'tx-1', toy_name: 'Fire truck' })]} pendingInvitesByTutorial={{}} onMarkRead={vi.fn()} onAcceptInvite={vi.fn()} onDeclineInvite={vi.fn()} />)
    expect(screen.getByText(/requested/i)).toBeInTheDocument()
    expect(screen.getByText(/fire truck/i)).toBeInTheDocument()
  })

  it('navigates to the exchange thread when a toy notification is clicked', async () => {
    const onMarkRead = vi.fn().mockResolvedValue(undefined)
    render(<NotificationsList notifications={[baseNotif({ type: 'toy_accepted', tutorial_id: null, tutorial_title: null, toy_transaction_id: 'tx-1', toy_name: 'Fire truck' })]} pendingInvitesByTutorial={{}} onMarkRead={onMarkRead} onAcceptInvite={vi.fn()} onDeclineInvite={vi.fn()} />)

    fireEvent.click(screen.getByText(/fire truck/i))

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/exchanges/tx-1'))
  })

  // linkFor is not exported: TypeScript's exhaustiveness check protects the
  // COPY map above, but not this ternary — an inverted condition or a
  // typo'd route string would ship silently without a test that clicks
  // through and checks where each row actually goes.
  describe('linkFor', () => {
    it('routes a toy_transaction_id row to its exchange thread', async () => {
      render(
        <NotificationsList
          notifications={[baseNotif({ type: 'toy_request', tutorial_id: null, tutorial_title: null, toy_transaction_id: 'tx-9', toy_name: 'Fire truck' })]}
          pendingInvitesByTutorial={{}}
          onMarkRead={vi.fn().mockResolvedValue(undefined)}
          onAcceptInvite={vi.fn()}
          onDeclineInvite={vi.fn()}
        />
      )
      fireEvent.click(screen.getByText(/fire truck/i))
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/exchanges/tx-9'))
    })

    it('routes a tutorial_id row to the tutorial edit page', async () => {
      render(
        <NotificationsList
          notifications={[baseNotif({ type: 'tutorial_approved', tutorial_id: 't9', tutorial_title: 'Spoon Holder' })]}
          pendingInvitesByTutorial={{}}
          onMarkRead={vi.fn().mockResolvedValue(undefined)}
          onAcceptInvite={vi.fn()}
          onDeclineInvite={vi.fn()}
        />
      )
      fireEvent.click(screen.getByText(/spoon holder/i))
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/tutorials/t9/edit'))
    })

    it('routes an idea_id row of type challenge_joined to the public challenge page', async () => {
      render(
        <NotificationsList
          notifications={[baseNotif({ type: 'challenge_joined', tutorial_id: null, tutorial_title: null, idea_id: 'idea-9' })]}
          pendingInvitesByTutorial={{}}
          onMarkRead={vi.fn().mockResolvedValue(undefined)}
          onAcceptInvite={vi.fn()}
          onDeclineInvite={vi.fn()}
        />
      )
      fireEvent.click(screen.getByText(/joined your design challenge/i))
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/get-involved/design-challenges/idea-9'))
    })

    it('routes an idea_id row of type idea_rejected to the author\'s own challenge list, not the public page', async () => {
      render(
        <NotificationsList
          notifications={[baseNotif({ type: 'idea_rejected', tutorial_id: null, tutorial_title: null, idea_id: 'idea-9' })]}
          pendingInvitesByTutorial={{}}
          onMarkRead={vi.fn().mockResolvedValue(undefined)}
          onAcceptInvite={vi.fn()}
          onDeclineInvite={vi.fn()}
        />
      )
      fireEvent.click(screen.getByText(/reviewed and not taken forward/i))
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/challenges'))
    })

    /*
     * The review-queue types are the only ones whose recipient is a reviewer
     * rather than the person the subject belongs to, and the only ones whose
     * destination depends on WHO is reading. Both branches are asserted because
     * the failure mode of the leader one is silent: /tutorials/:id/edit renders
     * for a leader and only fails when they try to save.
     */
    for (const type of ['backing_requested', 'tutorial_submitted'] as const) {
      it(`routes a ${type} row to the organisation hub for a leader`, async () => {
        render(
          <NotificationsList
            notifications={[baseNotif({ type, tutorial_id: 't9', tutorial_title: 'Spoon Holder' })]}
            pendingInvitesByTutorial={{}}
            onMarkRead={vi.fn().mockResolvedValue(undefined)}
            onAcceptInvite={vi.fn()}
            onDeclineInvite={vi.fn()}
          />
        )
        fireEvent.click(screen.getByText(/spoon holder/i))
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/organisation'))
      })

      it(`routes a ${type} row to the admin review screen for an admin`, async () => {
        render(
          <NotificationsList
            notifications={[baseNotif({ type, tutorial_id: 't9', tutorial_title: 'Spoon Holder' })]}
            pendingInvitesByTutorial={{}}
            isAdmin
            onMarkRead={vi.fn().mockResolvedValue(undefined)}
            onAcceptInvite={vi.fn()}
            onDeclineInvite={vi.fn()}
          />
        )
        fireEvent.click(screen.getByText(/spoon holder/i))
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/admin/review/t9'))
      })
    }

    // Tests: neither review-queue type falls through to the contributor's editor
    // How:   asserts on the copy, which names the actor — the tutorial_approved
    //        row above shares the same tutorial_id and would push /tutorials/t9/edit
    it('never sends a reviewer to the author\'s editor', async () => {
      render(
        <NotificationsList
          notifications={[baseNotif({ type: 'tutorial_submitted', tutorial_id: 't9', actor_name: 'Dana' })]}
          pendingInvitesByTutorial={{}}
          onMarkRead={vi.fn().mockResolvedValue(undefined)}
          onAcceptInvite={vi.fn()}
          onDeclineInvite={vi.fn()}
        />
      )
      expect(screen.getByText(/Dana submitted "Spoon Holder" for review/)).toBeInTheDocument()
      fireEvent.click(screen.getByText(/Dana submitted/))
      await waitFor(() => expect(mockPush).toHaveBeenCalled())
      expect(mockPush).not.toHaveBeenCalledWith('/tutorials/t9/edit')
    })
  })
})
