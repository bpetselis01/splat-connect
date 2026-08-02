import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NotificationsList } from '@/components/notifications-list'
import type { Notification } from '@splat-connect/types'

// run() calls router.refresh() after a successful action, so useRouter needs
// a mock outside Next's app router context (same as EditBackingSection's test).
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const baseNotif: Notification = {
  id: 'n1',
  recipient_id: 'u1',
  type: 'tutorial_approved',
  tutorial_id: 't1',
  actor_name: 'SPLAT',
  read_at: null,
  created_at: new Date().toISOString(),
  tutorials: { title: 'Spoon Holder' },
}

describe('NotificationsList', () => {
  it('renders a notification and marks it read on click', async () => {
    const onMarkRead = vi.fn().mockResolvedValue(undefined)
    render(
      <NotificationsList
        notifications={[baseNotif]}
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
    const inviteNotif: Notification = { ...baseNotif, id: 'n2', type: 'collaborator_invited' }
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
    const inviteNotif: Notification = { ...baseNotif, id: 'n3', type: 'collaborator_invited' }
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
})
