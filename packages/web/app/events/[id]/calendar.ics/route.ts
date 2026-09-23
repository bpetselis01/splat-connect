/**
 * "Add to calendar" — one event as an .ics file.
 *
 * A route rather than a data: URI on a link, for two reasons. The viewer
 * sandbox in some clients refuses a script-driven download, and an .ics built
 * in the browser would need the event's fields shipped to it again for a file
 * the server already has. This also gives the file a real name in the
 * downloads list rather than "download".
 *
 * Only ever a PUBLISHED event, and never the joining link. An online event's
 * URL is given to a registrant after they confirm — putting it in a file anyone
 * can fetch by id would be the leak the whole rule exists to prevent, and .ics
 * files get forwarded.
 *
 * Deliberately outside /get-involved: this is a file, not a page, and nesting
 * it under the event's own route would put a `calendar.ics` segment in the
 * breadcrumb trail's route table for a thing that has no breadcrumb.
 */
import { apiClient } from '@/lib/api-client'
import { buildCalendar, type EventListItem } from '@splat-connect/types'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const event = await apiClient.get<EventListItem>(`/api/public/events/${id}`).catch(() => null)
  if (!event || event.cancelled_at) {
    return new Response('Not found', { status: 404 })
  }

  // Escaping, folding, CRLF and the two-hour default end all live in the
  // shared builder, which the API's subscribable feed uses too.
  const body = buildCalendar([
    {
      uid: `${event.id}@splat-connect`,
      starts_at: event.starts_at,
      ends_at: event.ends_at,
      summary: event.title,
      location:
        event.format === 'online'
          ? 'Online'
          : [event.location, event.suburb, event.state].filter(Boolean).join(', '),
      description: event.summary ?? event.description ?? '',
    },
  ])

  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${event.id}.ics"`,
    },
  })
}
