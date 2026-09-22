/**
 * Formats an ISO timestamp as a short relative string for save-confirmation UI.
 * `now` is injectable so callers (and tests) get a deterministic reference point.
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const diffSec = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000))
  if (diffSec < 60) return 'just now'
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHour = Math.round(diffMin / 60)
  if (diffHour < 24) return `${diffHour}h ago`
  const diffDay = Math.round(diffHour / 24)
  return `${diffDay}d ago`
}

/** Whole days since `iso`, never negative. The clock read lives here, not in render. */
export function daysSince(iso: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000))
}

/**
 * `3 weeks ago` — the board's byline wording on a guide or a toy ("Updated 3
 * weeks ago", "Listed 3 weeks ago"). Coarser than formatRelativeTime on
 * purpose: a byline answers "is this stale?", not "when exactly?".
 */
export function agoInWords(iso: string, now: Date = new Date()): string {
  const days = daysSince(iso, now)
  const rtf = new Intl.RelativeTimeFormat('en-AU', { numeric: 'auto' })
  if (days < 7) return rtf.format(-days, 'day')
  if (days < 30) return rtf.format(-Math.floor(days / 7), 'week')
  if (days < 365) return rtf.format(-Math.floor(days / 30), 'month')
  return rtf.format(-Math.floor(days / 365), 'year')
}
