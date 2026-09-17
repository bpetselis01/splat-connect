/**
 * How an event's date and time are written, in one place.
 *
 * Every event screen shows the same instant in four different shapes — a
 * three-line date badge, a month heading, a long date, a time range — and they
 * have to agree or the same build day reads as two. So they are here rather
 * than inlined per page.
 *
 * Australia/Sydney throughout, and deliberately fixed rather than read off the
 * viewer's machine. SPLAT is Australian, an event's start time is a wall-clock
 * time at a venue, and a family in Perth reading "10am" about a Sydney build
 * day needs it to be the Sydney 10am the host meant — not 8am, which is what a
 * locale-aware render would give them. `formatTimeRange` is the one place that
 * says the zone out loud, on an online event, where it genuinely matters.
 *
 * `now` is injectable everywhere it is needed so the tests get a fixed
 * reference point rather than one that changes with the calendar.
 */
const ZONE = 'Australia/Sydney'

function parts(iso: string): Record<string, string> {
  const fmt = new Intl.DateTimeFormat('en-AU', {
    timeZone: ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  return Object.fromEntries(fmt.formatToParts(new Date(iso)).map((p) => [p.type, p.value]))
}

/**
 * The three-line badge on a list card: `Sun` / `20` / `Sep`.
 *
 * The month is clipped to three letters because en-AU renders September as
 * "Sept" and every other month as three — which is one month a year wider than
 * the fixed badge the card draws it in.
 */
export function dateBadge(iso: string): { weekday: string; day: string; month: string } {
  const p = parts(iso)
  return {
    weekday: (p.weekday ?? '').slice(0, 3),
    day: p.day ?? '',
    month: (p.month ?? '').slice(0, 3),
  }
}

/** The month heading a list groups under: `September 2026`. */
export function monthHeading(iso: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: ZONE,
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso))
}

/** Sortable key for that heading, so December sorts before the next January. */
export function monthKey(iso: string): string {
  const p = new Intl.DateTimeFormat('en-AU', { timeZone: ZONE, year: 'numeric', month: '2-digit' })
    .formatToParts(new Date(iso))
    .reduce<Record<string, string>>((acc, x) => ({ ...acc, [x.type]: x.value }), {})
  return `${p.year}-${p.month}`
}

/** The detail page's headline date: `Sunday 20 September 2026`. */
export function longDate(iso: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso))
}

/**
 * `10am–2pm`, or `11am–12pm AEST` when there is no venue to anchor it.
 *
 * Minutes are dropped on the hour, because "10:00am–2:00pm" is four characters
 * of noise on the overwhelmingly common case. The zone is spelled out only on
 * an online event: an in-person one is anchored by its address, and a family
 * reading a Crows Nest postcode does not need to be told which Australia it is
 * in.
 */
export function formatTimeRange(
  startIso: string,
  endIso: string | null,
  format: 'in_person' | 'online' = 'in_person',
): string {
  const clock = (iso: string) => {
    const p = parts(iso)
    const suffix = (p.dayPeriod ?? '').toLowerCase().replace(/[^a-z]/g, '')
    return p.minute === '00' ? `${p.hour}${suffix}` : `${p.hour}:${p.minute}${suffix}`
  }
  const zone = format === 'online' ? ' AEST' : ''
  return endIso ? `${clock(startIso)}–${clock(endIso)}${zone}` : `${clock(startIso)}${zone}`
}

/**
 * Whether an event has finished.
 *
 * Measured against its END, not its start, so a build day does not fold itself
 * into "Past events" over lunch while people are still at the benches. An event
 * with no end time is treated as lasting the rest of that day for the same
 * reason.
 */
export function isPast(startIso: string, endIso: string | null, now: Date = new Date()): boolean {
  if (endIso) return new Date(endIso).getTime() < now.getTime()
  const endOfDay = new Date(startIso)
  endOfDay.setHours(23, 59, 59, 999)
  return endOfDay.getTime() < now.getTime()
}
