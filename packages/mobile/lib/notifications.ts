// packages/mobile/lib/notifications.ts
// The copy and the routing behind the Inbox.
//
// The copy itself (COPY, copyFor) and the type → bucket map live in
// @splat-connect/types, shared with web and the API.
import type { Notification } from '@splat-connect/types'

/**
 * Where a notification lands on mobile. Web's linkFor with its hrefs swapped
 * for these routes; every branch below is web's branch, in web's order.
 */
export function linkFor(n: Notification): string {
  // A build has its own thread. Only these two types say so on the row; any
  // other notice about a build (toy_accepted on a claim, toy_message) opens the
  // exchange thread, which hands a build straight on — same as web.
  if (n.toy_transaction_id && (n.type === 'build_shot_posted' || n.type === 'build_approved')) {
    return `/exchanges/build/${n.toy_transaction_id}`
  }
  if (n.toy_transaction_id) return `/exchanges/${n.toy_transaction_id}`
  // 077. A conversation opens by its own id, for either side. A thanks goes
  // to the organisation hub — mobile has no profile editor to hide notes in.
  // A followed org's new event or story: mobile has no screen for either, so
  // /news reads which organisation it belongs to and opens that profile.
  if (n.org_conversation_id) return `/messages/${n.org_conversation_id}`
  if (n.type === 'org_thanked') return '/organisation'
  if (n.org_event_id) return `/news/event/${n.org_event_id}`
  if (n.org_story_id) return `/news/story/${n.org_story_id}`
  // Answered BEFORE the tutorial_id branch, exactly as on web: the recipient
  // of these two is a reviewer, not the author, and /tutorials/:id is the
  // author's editor — a leader sent there lands on a screen they cannot save.
  //
  // Web splits admin (/admin/review/:id) from leader (/dashboard/organisation)
  // here. Mobile has no admin review screen at all, so both collapse to the
  // organisation hub, which lists everything waiting on them either way.
  if (n.type === 'backing_requested' || n.type === 'tutorial_submitted') return '/organisation'
  // Web's thanks branch: the published guide, not the editor.
  if (n.type === 'tutorial_thanked' && n.tutorial_id) return `/guides/${n.tutorial_id}`
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
