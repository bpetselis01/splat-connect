import { apiClient } from '@/lib/api-client'
import { revalidatePath } from 'next/cache'
import { NotificationsList } from '@/components/notifications-list'
import type { Notification, TutorialCollaboratorInvite } from '@splat-connect/types'

export default async function NotificationsPage() {
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
    <div>
      <h1 className="mb-6 text-xl font-bold text-ink">Notifications</h1>
      <NotificationsList
        notifications={notifications}
        pendingInvitesByTutorial={pendingInvitesByTutorial}
        onMarkRead={markRead}
        onAcceptInvite={acceptInvite}
        onDeclineInvite={declineInvite}
      />
    </div>
  )
}
