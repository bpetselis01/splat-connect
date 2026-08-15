'use client'
/**
 * The notification inbox list. A client component because marking read and
 * answering an invite both need a busy state — same shape as
 * EditBackingSection's run().
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import type { Notification, NotificationType } from '@splat-connect/types'

const COPY: Record<NotificationType, (n: Notification) => string> = {
  collaborator_invited: (n) => `${n.actor_name} invited you to collaborate on "${n.tutorial_title}"`,
  collaborator_accepted: (n) => `${n.actor_name} accepted your invite to "${n.tutorial_title}"`,
  collaborator_declined: (n) => `${n.actor_name} declined your invite to "${n.tutorial_title}"`,
  collaborator_removed: (n) => `${n.actor_name} removed you from "${n.tutorial_title}"`,
  collaborator_left: (n) => `${n.actor_name} left "${n.tutorial_title}"`,
  tutorial_approved: (n) => `"${n.tutorial_title}" was approved and is now published`,
  tutorial_rejected: (n) => `"${n.tutorial_title}" was rejected`,
  toy_request: (n) => `${n.actor_name} requested ${n.toy_name}`,
  toy_accepted: (n) => `${n.actor_name} accepted your request for ${n.toy_name}`,
  toy_rejected: (n) => `${n.actor_name} declined your request for ${n.toy_name}`,
  toy_withdrawn: (n) => `${n.actor_name} withdrew their request for ${n.toy_name}`,
  toy_message: (n) => `${n.actor_name} sent a message about ${n.toy_name}`,
}

function linkFor(n: Notification): string {
  if (n.toy_transaction_id) return `/dashboard/exchanges/${n.toy_transaction_id}`
  if (n.tutorial_id) return `/tutorials/${n.tutorial_id}/edit`
  return '/notifications'
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
        const inviteId = n.type === 'collaborator_invited' ? pendingInvitesByTutorial[n.tutorial_id!] : undefined
        return (
          <li key={n.id} className={`card-flat px-4 py-3 text-sm ${n.read_at ? 'opacity-60' : ''}`}>
            <button
              type="button"
              onClick={() => run(n.id, async () => {
                await onMarkRead(n.id)
                router.push(linkFor(n) as Route<string>)
              })}
              className="text-left font-medium text-ink hover:underline"
            >
              {COPY[n.type](n)}
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
