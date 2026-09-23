'use client'
/**
 * The notification inbox list. A client component because marking read and
 * answering an invite both need a busy state — same shape as
 * EditBackingSection's run().
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import type { ComponentType, SVGProps } from 'react'
import type { Notification, NotificationType } from '@splat-connect/types'
import { BookOpen, Box, Check, FileText, Handshake, Inbox, Lightbulb, Undo, User } from '@/components/icons'

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
  // Unnamed on purpose: who thanked a guide stays private (066).
  tutorial_thanked: (n) => `A family said thanks for "${n.tutorial_title}"`,
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
  // challenge-card.tsx's "Being written up" and badge.tsx
  // exactly; must never claim more than those two do.
  idea_graduated: () => 'A challenge you were part of is being written up as a guide, and you are credited on it',
  build_shot_posted: (n) => `${n.actor_name} posted a photo of ${n.toy_name} working`,
  build_approved: (n) => `${n.actor_name} approved the working shot for ${n.toy_name}`,
  print_started: (n) => `${n.actor_name} started printing ${n.toy_name}`,
  print_ready: (n) => `${n.actor_name} finished printing ${n.toy_name}`,
}

// A type the database allows but this build has no line for — a newer API,
// or a type added without copy — must still render. COPY[n.type](n) with no
// fallback took the whole inbox down when the four build/print types landed.
const copyFor = (n: Notification) => COPY[n.type]?.(n) ?? `${n.actor_name} updated something you're part of`

type Glyph = ComponentType<SVGProps<SVGSVGElement>>
// The board's icon tile: a tint per kind of news, the glyph always in --tink.
const ICON: Record<NotificationType, [Glyph, string]> = {
  collaborator_invited: [Handshake, 'var(--tmint)'],
  collaborator_accepted: [Handshake, 'var(--tmint)'],
  collaborator_declined: [User, 'var(--b100)'],
  collaborator_removed: [User, 'var(--b100)'],
  collaborator_left: [User, 'var(--b100)'],
  backing_requested: [Inbox, 'var(--b100)'],
  tutorial_submitted: [Inbox, 'var(--b100)'],
  tutorial_approved: [Check, 'var(--tok)'],
  tutorial_rejected: [Undo, 'var(--tbad)'],
  tutorial_thanked: [BookOpen, 'var(--tamber)'],
  toy_request: [Box, 'var(--tcoral)'],
  toy_accepted: [Handshake, 'var(--tmint)'],
  toy_rejected: [Undo, 'var(--tbad)'],
  toy_withdrawn: [Box, 'var(--tcoral)'],
  toy_message: [Box, 'var(--tcoral)'],
  idea_approved: [Lightbulb, 'var(--tamber)'],
  idea_rejected: [Undo, 'var(--tbad)'],
  challenge_joined: [Lightbulb, 'var(--tamber)'],
  challenge_left: [Lightbulb, 'var(--tamber)'],
  challenge_removed: [Lightbulb, 'var(--tamber)'],
  idea_graduated: [FileText, 'var(--tviolet)'],
  build_shot_posted: [Box, 'var(--tcoral)'],
  build_approved: [Check, 'var(--tok)'],
  print_started: [Box, 'var(--tcoral)'],
  print_ready: [Check, 'var(--tok)'],
}

function linkFor(n: Notification, isAdmin: boolean): string {
  // Builds and print jobs have their own detail screens; the exchange thread
  // is only for toys.
  if (n.toy_transaction_id && (n.type === 'build_shot_posted' || n.type === 'build_approved')) {
    return `/dashboard/exchanges/build/${n.toy_transaction_id}`
  }
  if (n.toy_transaction_id && (n.type === 'print_started' || n.type === 'print_ready')) {
    return `/dashboard/print-requests/${n.toy_transaction_id}`
  }
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
  // A thank is about the published guide, not work to do on it — the public
  // page, where the count it added is visible, not the editor.
  if (n.type === 'tutorial_thanked' && n.tutorial_id) return `/tutorials/${n.tutorial_id}`
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
    <ul className="flex flex-col gap-2.5">
      {notifications.map((n) => {
        const inviteId = n.type === 'collaborator_invited' ? pendingInvitesByTutorial[n.tutorial_id!] : undefined
        const [Glyph, tint] = ICON[n.type] ?? [Inbox, 'var(--b100)']
        return (
          // The whole card is the target, as the board draws it; the title
          // button's ::after stretches over it so the invite buttons can still
          // sit inside without nesting one button in another.
          <li
            key={n.id}
            className="relative flex items-start gap-3.5 rounded-[18px] border border-line p-[18px] text-ink shadow-e1 transition-shadow hover:shadow-e2"
            style={{ background: n.read_at ? 'var(--surface)' : 'var(--b50)' }}
          >
            <span
              aria-hidden="true"
              className="grid h-[42px] w-[42px] flex-none place-items-center rounded-[14px] text-[22px] text-[var(--tink)]"
              style={{ background: tint }}
            >
              <Glyph />
            </span>
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => run(n.id, async () => {
                  await onMarkRead(n.id)
                  router.push(linkFor(n, isAdmin) as Route<string>)
                })}
                className="block text-left text-[15px] font-extrabold text-ink after:absolute after:inset-0 after:rounded-[18px] after:content-['']"
              >
                {copyFor(n)}
              </button>
              {inviteId && (
                <div className="relative z-10 mt-2 flex gap-2">
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
            </div>
            <span className="flex flex-none flex-col items-end gap-1.5">
              <span className="text-xs font-semibold text-muted">
                {new Date(n.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
              </span>
              {!n.read_at && (
                <span aria-label="Unread" className="h-[9px] w-[9px] rounded-full bg-[var(--coral)]" />
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
