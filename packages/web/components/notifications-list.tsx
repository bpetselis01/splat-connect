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
  // The two review-queue types. Both name the actor and the project, because
  // unlike every other type above the recipient did not start this and has no
  // context for it — a leader may be looking at a title they have never seen.
  backing_requested: (n) => `${n.actor_name} asked your organisation to back "${n.tutorial_title}"`,
  tutorial_submitted: (n) => `${n.actor_name} submitted "${n.tutorial_title}" for review`,
  tutorial_approved: (n) => `"${n.tutorial_title}" was approved and is now published`,
  tutorial_rejected: (n) => `"${n.tutorial_title}" was rejected`,
  toy_request: (n) => `${n.actor_name} requested ${n.toy_name}`,
  toy_accepted: (n) => `${n.actor_name} accepted your request for ${n.toy_name}`,
  toy_rejected: (n) => `${n.actor_name} declined your request for ${n.toy_name}`,
  toy_withdrawn: (n) => `${n.actor_name} withdrew their request for ${n.toy_name}`,
  toy_message: (n) => `${n.actor_name} sent a message about ${n.toy_name}`,
  idea_approved: () => 'Your idea was published as a design challenge',
  idea_rejected: () => 'Your idea was reviewed and not taken forward',
  challenge_joined: (n) => `${n.actor_name} joined your design challenge`,
  challenge_left: (n) => `${n.actor_name} left your design challenge`,
  challenge_removed: (n) => `${n.actor_name} removed you from a design challenge`,
  // Two audiences read this since admin.ts's graduate handler notifies the
  // author (tutorial_contributors role 'primary') and every current
  // participant (role 'collaborator') alike — the wording must be true for
  // both without naming a role either could contradict, and it isn't the
  // author's idea from a participant's side either. Also honest about what
  // graduation actually did: a tutorial row now exists with status 'draft'
  // (admin.ts:375), not solved, not in review, not published. Matches
  // challenge-card.tsx's "Being written up" and idea-status-badge.tsx
  // exactly; must never claim more than those two do.
  idea_graduated: () => 'A challenge you were part of is being written up as a guide, and you are credited on it',
}

function linkFor(n: Notification, isAdmin: boolean): string {
  if (n.toy_transaction_id) return `/dashboard/exchanges/${n.toy_transaction_id}`
  // The two review-queue types must be answered BEFORE the tutorial_id branch
  // below: their recipient is a reviewer, not a contributor, and
  // /tutorials/:id/edit is the author's editor — a leader following it lands on
  // a screen RLS will not let them save, having been told to go there.
  //
  // Where a reviewer belongs depends on which kind they are, and the row itself
  // cannot say: it carries no org_id, so the exact review screen
  // (/organizations/:id/projects/:tutorialId) is not constructible from it. A
  // leader goes to their own organisation hub, which already lists everything
  // waiting on them; an admin goes straight to the review screen they own.
  // Adding org_id to notifications would collapse the leader's two clicks to
  // one — deliberately deferred until that click is actually felt.
  if (n.type === 'backing_requested' || n.type === 'tutorial_submitted') {
    return isAdmin && n.tutorial_id ? `/admin/review/${n.tutorial_id}` : '/dashboard/organisation'
  }
  if (n.tutorial_id) return `/tutorials/${n.tutorial_id}/edit`
  // A rejected idea has no public page. Not because of RLS — 037 also grants
  // "Authors see their own ideas at any status", so an author's own rejected
  // idea does pass RLS — but because GET /api/public/challenges/:id (Task 8)
  // filters .in('status', ['challenge','graduated']) with the admin client and
  // 404s otherwise, making the public page unreachable regardless of RLS. So
  // send the author to their own list instead.
  // idea_graduated needs no exception here, unlike idea_rejected above: a
  // graduated idea stays selectable by GET /api/public/challenges/:id
  // (status in ('challenge','graduated')), so the public brief the author
  // lands on is the real page, not a 404. And if the notification carries a
  // tutorial_id — the graduated idea's author is exactly who admin.ts:390
  // adds as the new draft's primary contributor — the tutorial_id branch
  // above already sends them to /tutorials/:id/edit instead, which is the
  // more useful landing spot when it's available.
  if (n.idea_id) {
    return n.type === 'idea_rejected'
      ? '/dashboard/challenges'
      : `/get-involved/design-challenges/${n.idea_id}`
  }
  return '/notifications'
}

export function NotificationsList({
  notifications,
  pendingInvitesByTutorial,
  isAdmin = false,
  onMarkRead,
  onAcceptInvite,
  onDeclineInvite,
}: {
  notifications: Notification[]
  pendingInvitesByTutorial: Record<string, string>
  /** Only linkFor reads it: an admin and a leader are sent to different review
      screens by the same notification type. Defaults false so every existing
      call site and test keeps its current behaviour. */
  isAdmin?: boolean
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
                router.push(linkFor(n, isAdmin) as Route<string>)
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
