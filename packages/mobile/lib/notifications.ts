// packages/mobile/lib/notifications.ts
// The copy and the routing behind the Inbox.
//
// COPY is ported VERBATIM from web's components/notifications-list.tsx — all
// twenty of them. Two clients narrating the same event differently is how a
// person ends up unsure whether they read about one thing or two, so the
// wording is not "improved" here; change it on web first.
//
// The type → bucket map is NOT ported: @splat-connect/types already exports
// notificationBucket() and the API groups by the same function, so a mobile
// copy would be the third and would drift first.
import type { Notification, NotificationType } from '@splat-connect/types'

export const COPY: Record<NotificationType, (n: Notification) => string> = {
  collaborator_invited: (n) => `${n.actor_name} invited you to collaborate on "${n.tutorial_title}"`,
  collaborator_accepted: (n) => `${n.actor_name} accepted your invite to "${n.tutorial_title}"`,
  collaborator_declined: (n) => `${n.actor_name} declined your invite to "${n.tutorial_title}"`,
  collaborator_removed: (n) => `${n.actor_name} removed you from "${n.tutorial_title}"`,
  collaborator_left: (n) => `${n.actor_name} left "${n.tutorial_title}"`,
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
  idea_graduated: () =>
    'A challenge you were part of is being written up as a guide, and you are credited on it',
}

/**
 * Where a notification lands on mobile. Web's linkFor with its hrefs swapped
 * for these routes; every branch below is web's branch, in web's order.
 */
export function linkFor(n: Notification): string {
  if (n.toy_transaction_id) return `/exchanges/${n.toy_transaction_id}`
  // Answered BEFORE the tutorial_id branch, exactly as on web: the recipient
  // of these two is a reviewer, not the author, and /tutorials/:id is the
  // author's editor — a leader sent there lands on a screen they cannot save.
  //
  // Web splits admin (/admin/review/:id) from leader (/dashboard/organisation)
  // here. Mobile has no admin review screen at all, so both collapse to the
  // organisation hub, which lists everything waiting on them either way.
  if (n.type === 'backing_requested' || n.type === 'tutorial_submitted') return '/organisation'
  if (n.tutorial_id) return `/tutorials/${n.tutorial_id}`
  // A rejected idea has no public page — GET /api/public/challenges/:id filters
  // to challenge|graduated and 404s otherwise, whatever RLS would allow — so
  // its author goes to their own list instead. A graduated one needs no such
  // exception: it is still selectable, so the brief is a real page.
  if (n.idea_id) {
    return n.type === 'idea_rejected' ? '/challenges' : `/explore/challenges/${n.idea_id}`
  }
  return '/inbox'
}

const DIVISIONS: [number, Intl.RelativeTimeFormatUnit][] = [
  [60, 'second'],
  [60, 'minute'],
  [24, 'hour'],
  [7, 'day'],
  [4.34524, 'week'],
  [12, 'month'],
  [Number.POSITIVE_INFINITY, 'year'],
]

// The numeric:'auto' words for ±1, which is the only place Intl and plain
// "N units ago" phrasing differ. second/minute/hour have no such words.
const AUTO_WORDS: Partial<Record<Intl.RelativeTimeFormatUnit, [past: string, future: string]>> = {
  day: ['yesterday', 'tomorrow'],
  week: ['last week', 'next week'],
  month: ['last month', 'next month'],
  year: ['last year', 'next year'],
}

// Hermes — the one runtime this module actually ships to — does not implement
// Intl.RelativeTimeFormat; `new` on it crashed the whole inbox (2026-09-01).
// This mirrors Intl's en-AU numeric:'auto' output for the values we produce.
function fallbackRelative(value: number, unit: Intl.RelativeTimeFormatUnit): string {
  if (value === 0) return unit === 'second' ? 'now' : `this ${unit}`
  const words = AUTO_WORDS[unit]
  if (words && Math.abs(value) === 1) return value < 0 ? words[0] : words[1]
  const n = Math.abs(value)
  const noun = n === 1 ? unit : `${unit}s`
  return value < 0 ? `${n} ${noun} ago` : `in ${n} ${noun}`
}

/**
 * "3 hours ago", "yesterday". Intl.RelativeTimeFormat where the runtime has
 * it — it gets "yesterday" and the plurals right — with a fallback matching
 * its output on Hermes, which does not.
 *
 * `now` is a parameter so a test can pin it; nothing else passes it.
 */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const format =
    typeof Intl.RelativeTimeFormat === 'function'
      ? new Intl.RelativeTimeFormat('en-AU', { numeric: 'auto' })
      : null
  let delta = (new Date(iso).getTime() - now) / 1000
  for (const [amount, unit] of DIVISIONS) {
    if (Math.abs(delta) < amount) {
      const value = Math.round(delta)
      return format ? format.format(value, unit) : fallbackRelative(value, unit)
    }
    delta /= amount
  }
  // Unreachable: the last division is Infinity, so the loop always returns.
  return ''
}
