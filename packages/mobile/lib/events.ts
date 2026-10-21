// packages/mobile/lib/events.ts
// What GET /api/public/events/:id returns: the list item plus the host, the
// organiser's questions and the going initials. Shared by the detail, register
// and print-at-event screens, which all start from the same read.
import type { EventListItem, OrgEventQuestion } from '@splat-connect/types'

export type EventDetail = EventListItem & {
  org: { id: string; name: string; description: string | null; suburb: string | null; state: string | null } | null
  questions: OrgEventQuestion[]
  attendee_initials: string[]
}

/** The viewer id is how the API marks `viewer_going`; a guest sends none. */
export const eventPath = (id: string, viewerId?: string | null) =>
  `/api/public/events/${id}${viewerId ? `?viewer=${viewerId}` : ''}`
