'use client'
/**
 * The notification inbox list. A client component because marking read and
 * answering an invite both need a busy state — same shape as
 * EditBackingSection's run().
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Notification, NotificationType } from '@splat-connect/types'

const COPY: Record<NotificationType, (actor: string, title: string) => string> = {
  collaborator_invited: (actor, title) => `${actor} invited you to collaborate on "${title}"`,
  collaborator_accepted: (actor, title) => `${actor} accepted your invite to "${title}"`,
  collaborator_declined: (actor, title) => `${actor} declined your invite to "${title}"`,
  collaborator_removed: (actor, title) => `${actor} removed you from "${title}"`,
  collaborator_left: (actor, title) => `${actor} left "${title}"`,
  tutorial_approved: (_actor, title) => `"${title}" was approved and is now published`,
  tutorial_rejected: (_actor, title) => `"${title}" was rejected`,
}

export function NotificationsList({
  notifications,
  pendingInvitesByTutorial,
  onMarkRead,
  onAcceptInvite,
  onDeclineInvite,
}: {
  notifications: Notification[]
  pendingInvitesByTutorial: Record<string, string>
  onMarkRead: (id: string) => Promise<void>
  onAcceptInvite: (inviteId: string) => Promise<void>
  onDeclineInvite: (inviteId: string) => Promise<void>
}) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)

  async function run(key: string, fn: () => Promise<void>) {
    setPending(key)
    try {
      await fn()
      router.refresh()
    } finally {
      setPending(null)
    }
  }

  if (notifications.length === 0) {
    return <p className="text-sm text-muted">Nothing yet.</p>
  }

  return (
    <ul className="flex flex-col gap-2">
      {notifications.map((n) => {
        const title = n.tutorial_title
        const inviteId = n.type === 'collaborator_invited' ? pendingInvitesByTutorial[n.tutorial_id] : undefined
        return (
          <li key={n.id} className={`card-flat px-4 py-3 text-sm ${n.read_at ? 'opacity-60' : ''}`}>
            <button
              type="button"
              onClick={() => run(n.id, () => onMarkRead(n.id))}
              className="text-left font-medium text-ink hover:underline"
            >
              {COPY[n.type](n.actor_name, title)}
            </button>
            {inviteId && (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() => run(inviteId, () => onAcceptInvite(inviteId))}
                  className="btn btn-accent btn-sm"
                >
                  {pending === inviteId ? 'Accepting…' : 'Accept'}
                </button>
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() => run(`decline-${inviteId}`, () => onDeclineInvite(inviteId))}
                  className="btn btn-quiet btn-sm"
                >
                  Decline
                </button>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
