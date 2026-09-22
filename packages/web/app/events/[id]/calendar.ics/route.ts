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
import type { EventListItem } from '@splat-connect/types'

/** RFC 5545 wants UTC as YYYYMMDDTHHMMSSZ, with no punctuation. */
function stamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/**
 * Escapes a value for an .ics line. Commas, semicolons and backslashes are
 * structural in this format, and a venue like "Northside Therapy, 14 Corella
 * St" silently truncates the address without this.
 */
function esc(value: string): string {
  return value.replace(/([\\;,])/g, '\\$1').replace(/\n/g, '\\n')
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const event = await apiClient.get<EventListItem>(`/api/public/events/${id}`).catch(() => null)
  if (!event || event.cancelled_at) {
    return new Response('Not found', { status: 404 })
  }

  const where =
    event.format === 'online'
      ? 'Online'
      : [event.location, event.suburb, event.state].filter(Boolean).join(', ')

  // An event with no end time gets two hours, which is the shortest thing that
  // is not a lie: a zero-length calendar entry renders as a point and vanishes
  // in a week view.
  const end = event.ends_at ?? new Date(new Date(event.starts_at).getTime() + 2 * 60 * 60 * 1000).toISOString()

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SPLAT Connect//Events//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${event.id}@splat-connect`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(event.starts_at)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(event.title)}`,
    `LOCATION:${esc(where)}`,
    `DESCRIPTION:${esc(event.summary ?? event.description ?? '')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  // CRLF, not LF. RFC 5545 requires it and some calendar clients reject the
  // file outright without it.
  return new Response(`${lines.join('\r\n')}\r\n`, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${event.id}.ics"`,
    },
  })
}
