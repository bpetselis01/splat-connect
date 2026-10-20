import type { Route } from 'next'
/**
 * Validates a `?next=` query value before it is ever handed to
 * `window.location.href`. That assignment is an open redirect if `next` is
 * trusted blindly: `/login?next=https://evil.example` would send a user who
 * just proved they trust this site straight off it.
 *
 * Only a same-origin, absolute-from-root path is accepted. Everything else
 * — including protocol-relative `//host` and `/\host` (browsers treat a
 * backslash as a `/` inside a URL, so `/\evil.example` is the same attack as
 * `//evil.example`), and a scheme obfuscated with a leading space or an
 * embedded tab/newline (browsers strip those before parsing a URL, so
 * `java\tscript:` becomes `javascript:`) — is rejected.
 */
export function sanitiseNextPath(next: string | null | undefined): string | null {
  if (!next) return null

  const normalised = next.replace(/[\t\n\r]/g, '').trim()
  if (normalised === '') return null
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(normalised)) return null // has a scheme
  if (normalised.startsWith('//')) return null // protocol-relative
  if (normalised.includes('\\')) return null // backslash anywhere, incl. `/\`
  if (!normalised.startsWith('/')) return null // must be absolute-from-root

  return normalised
}

/**
 * The one builder for a sign-in or sign-up link that returns to `pathWithQuery`.
 * It sanitises its input, so a caller can pass a request-derived path without
 * checking it first; an unsafe or empty path yields the bare auth URL.
 */
export function authUrl(
  kind: 'login' | 'signup',
  pathWithQuery: string | null | undefined,
  extraParams: Record<string, string> = {}
): Route {
  const params = new URLSearchParams()
  const next = sanitiseNextPath(pathWithQuery)
  if (next) params.set('next', next)
  for (const [k, v] of Object.entries(extraParams)) params.set(k, v)
  const query = params.toString()
  return (query ? `/${kind}?${query}` : `/${kind}`) as Route
}

/** The contributor-terms screen, returning to `pathWithQuery` once accepted. */
export function termsUrl(pathWithQuery: string | null | undefined): Route {
  const next = sanitiseNextPath(pathWithQuery)
  return `/onboarding/contributor-terms${next ? `?next=${encodeURIComponent(next)}` : ''}` as Route
}
