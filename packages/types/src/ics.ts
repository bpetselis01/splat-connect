/**
 * An RFC 5545 calendar, built once for both of its readers: web's per-event
 * "Add to calendar" file and the API's subscribable feed of every event. Two
 * copies of the escaping and folding rules would drift, and a calendar client
 * that rejects one file rejects it silently.
 */

export interface CalendarEvent {
  /** Stable across fetches, or a subscribed calendar duplicates the event. */
  uid: string
  starts_at: string
  /** Null gets two hours — see `buildCalendar`. */
  ends_at: string | null
  summary: string
  location?: string | null
  url?: string | null
  description?: string | null
}

/** UTC as YYYYMMDDTHHMMSSZ, with no punctuation. */
function icsStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/**
 * Escapes a TEXT value. Commas, semicolons and backslashes are structural, and
 * a venue like "Northside Therapy, 14 Corella St" silently truncates the
 * address without this.
 */
function icsEscape(value: string): string {
  return value.replace(/([\\;,])/g, '\\$1').replace(/\r?\n/g, '\\n')
}

/** UTF-8 length of one code point. Arithmetic rather than TextEncoder: this
 *  module loads on the phone too, and Hermes is the smallest runtime it meets. */
function octets(ch: string): number {
  const cp = ch.codePointAt(0)!
  return cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4
}

/**
 * Folds a content line at 75 octets (RFC 5545 §3.1): CRLF then one space, which
 * the reader drops. Octets, not characters — an en dash is three — and never
 * inside a character, so a fold cannot split one.
 */
function icsFold(line: string): string {
  const out: string[] = []
  let current = ''
  let bytes = 0
  for (const ch of line) {
    const size = octets(ch)
    // A continuation line's leading space counts toward its 75.
    const limit = out.length === 0 ? 75 : 74
    if (bytes + size > limit) {
      out.push(current)
      current = ''
      bytes = 0
    }
    current += ch
    bytes += size
  }
  out.push(current)
  return out.join('\r\n ')
}

/**
 * The whole file, CRLF-terminated — RFC 5545 requires it and some clients
 * refuse a file without it. An event with no end time gets two hours, the
 * shortest thing that is not a lie: a zero-length entry renders as a point and
 * vanishes in a week view.
 */
export function buildCalendar(
  events: CalendarEvent[],
  { name, now = new Date() }: { name?: string; now?: Date } = {},
): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SPLAT Connect//Events//EN', 'CALSCALE:GREGORIAN']
  if (name) lines.push(`X-WR-CALNAME:${icsEscape(name)}`)
  for (const e of events) {
    const end = e.ends_at ?? new Date(new Date(e.starts_at).getTime() + 2 * 60 * 60 * 1000).toISOString()
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${icsStamp(now.toISOString())}`,
      `DTSTART:${icsStamp(e.starts_at)}`,
      `DTEND:${icsStamp(end)}`,
      `SUMMARY:${icsEscape(e.summary)}`,
    )
    if (e.location) lines.push(`LOCATION:${icsEscape(e.location)}`)
    // URI, not TEXT: a URL is not escaped.
    if (e.url) lines.push(`URL:${e.url}`)
    if (e.description) lines.push(`DESCRIPTION:${icsEscape(e.description)}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return `${lines.map(icsFold).join('\r\n')}\r\n`
}
