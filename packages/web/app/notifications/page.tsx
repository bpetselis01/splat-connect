import { apiClient } from '@/lib/api-client'
import { getCapabilities } from '@/lib/capabilities'
import { revalidatePath } from 'next/cache'
import { NotificationsList } from '@/components/notifications-list'
import type { Notification, TutorialCollaboratorInvite } from '@splat-connect/types'

export default async function NotificationsPage() {
  // caps is React-cached and the root layout has already fetched it on this
  // request, so this costs nothing beyond the lookup.
  const caps = await getCapabilities()
  const [notifications, invites] = await Promise.all([
    apiClient.get<Notification[]>('/api/notifications/me').catch(() => [] as Notification[]),
    apiClient.get<TutorialCollaboratorInvite[]>('/api/collaborators/me/invites').catch(() => [] as TutorialCollaboratorInvite[]),
  ])

  const pendingInvitesByTutorial: Record<string, string> = {}
  for (const invite of invites) pendingInvitesByTutorial[invite.tutorial_id] = invite.id

  async function markRead(id: string) {
    'use server'
    await apiClient.patch(`/api/notifications/${id}`, { read: true })
    revalidatePath('/notifications')
  }

  // No bulk endpoint exists, so this is one PATCH per unread row.
  // ponytail: N requests; add a POST /me/read-all if inboxes grow long.
  async function markAllRead() {
    'use server'
    // Re-read rather than close over the page's list: a closure would be
    // serialised into the form and could be stale by the time it is posted.
    const rows = await apiClient.get<Notification[]>('/api/notifications/me')
    const unread = rows.filter((n) => !n.read_at)
    await Promise.all(unread.map((n) => apiClient.patch(`/api/notifications/${n.id}`, { read: true })))
    revalidatePath('/notifications')
  }

  async function acceptInvite(inviteId: string) {
    'use server'
    await apiClient.post(`/api/collaborators/invites/${inviteId}/accept`, {})
    revalidatePath('/notifications')
  }

  async function declineInvite(inviteId: string) {
    'use server'
    await apiClient.post(`/api/collaborators/invites/${inviteId}/decline`, {})
    revalidatePath('/notifications')
  }

  return (
    <section className="max-w-[760px]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="title-hub">Notifications</h1>
          <p className="mt-2 text-[15px] text-muted">Everything SPLAT has told you.</p>
        </div>
        {notifications.some((n) => !n.read_at) && (
          <form action={markAllRead}>
            <button type="submit" className="btn btn-quiet">
              Mark all read
            </button>
          </form>
        )}
      </div>
      <NotificationsList
        notifications={notifications}
        pendingInvitesByTutorial={pendingInvitesByTutorial}
        isAdmin={!!caps?.isAdmin}
        onMarkRead={markRead}
        onAcceptInvite={acceptInvite}
        onDeclineInvite={declineInvite}
      />
    </section>
  )
}
