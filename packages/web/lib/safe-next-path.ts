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
