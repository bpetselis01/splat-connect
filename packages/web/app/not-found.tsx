/**
 * The 404 body, rendered inside app/layout.tsx like any page.
 *
 * It exists mostly so that it exists. With no not-found boundary anywhere in
 * the tree, notFound() fell through to Next's built-in page, which does not
 * use the root layout — so a signed-in visitor who followed a stale link lost
 * the rail, the header and every way back at once. The 2026-08-28 chrome audit
 * caught it on /dashboard/child/[id] and /dashboard/exchanges/[id], and the
 * result was inconsistent as well as bare: routes whose shell had already been
 * flushed kept their chrome, routes that called notFound() sooner did not.
 *
 * One link, not two: the chrome is back by the time this renders, so the rail
 * already carries "Back to My SPLAT" and the header carries the whole public
 * nav. BoundaryLink rather than Link because that one link crosses the account
 * boundary exactly when the miss happened inside the account section.
 */
import { BoundaryLink } from '@/components/boundary-link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span aria-hidden="true" className="empty-badge text-2xl font-bold text-brand-dark">
        ?
      </span>
      <h1 className="mt-4 text-2xl font-bold text-ink">We couldn&apos;t find that page</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
        The link may be out of date, or whatever it pointed at may have been removed.
      </p>
      <BoundaryLink href="/" className="btn btn-accent mt-6">
        Back to the home page
      </BoundaryLink>
    </div>
  )
}
