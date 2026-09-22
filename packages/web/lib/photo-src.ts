/**
 * Guard for photo URLs that came out of the database.
 *
 * `next/image` throws at *render* time when handed a host that is not in
 * next.config.ts's `remotePatterns`. Because these components render inside the
 * page, that throw is not a broken image — it is a 500 on the whole route. One
 * stale row took down `/`, `/library` and `/toy-library` simultaneously, and a
 * data cleanup does not fix it: the next bad row does it again, and a
 * `supabase db reset` brings the old ones back.
 *
 * So the invariant is enforced here instead: a URL from the database is
 * untrusted input, and anything we cannot prove renderable degrades to the
 * caller's own placeholder. Keep ALLOWED in step with next.config.ts.
 */

/** Hosts next.config.ts configures for next/image. */
function isAllowedRemote(url: URL): boolean {
  // Cloud storage: https://<project>.supabase.co/storage/v1/object/public/**
  if (
    url.protocol === 'https:' &&
    url.hostname.endsWith('.supabase.co') &&
    url.pathname.startsWith('/storage/v1/object/public/')
  ) {
    return true
  }
  // Local Supabase stack, dev and E2E only.
  if (
    url.protocol === 'http:' &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
    url.pathname.startsWith('/storage/v1/object/public/')
  ) {
    return true
  }
  return false
}

/**
 * Returns `src` when next/image can render it, else null so the caller falls
 * back to its placeholder. Relative paths are ours and always pass.
 */
export function safePhotoSrc(src: string | null | undefined): string | null {
  if (!src) return null
  if (src.startsWith('/')) return src
  let url: URL
  try {
    url = new URL(src)
  } catch {
    return null
  }
  return isAllowedRemote(url) ? src : null
}
