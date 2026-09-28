import Link from 'next/link'
import type { Route } from 'next'

/**
 * Previous / Page n of m / Next for a list cut by lib/paginate.ts. Keeps the
 * page's other query params (filters, search) on both links. Renders nothing
 * for a single page.
 */
export function Pager({
  page,
  pages,
  params = {},
}: {
  page: number
  pages: number
  params?: Record<string, string | undefined>
}) {
  if (pages <= 1) return null
  const href = (p: number) => {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v && k !== 'page') q.set(k, v)
    if (p > 1) q.set('page', String(p))
    const s = q.toString()
    return (s ? `?${s}` : '?') as Route
  }
  return (
    <nav aria-label="Pages" className="mt-8 flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className="btn btn-quiet no-underline">
          ← Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm font-bold text-muted">
        Page {page} of {pages}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} rel="next" className="btn btn-quiet no-underline">
          Next →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  )
}
