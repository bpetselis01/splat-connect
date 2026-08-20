/**
 * The fat footer: the entire public sitemap, on every public page.
 *
 * This closes the one real gap in a dropdown-free nav — the section subnav only
 * helps once you are already inside a section, so crossing from deep in Learn to
 * deep in Get Involved would otherwise cost two clicks. The footer makes every
 * destination one click from every page, which is exactly what a dropdown does,
 * using plain links instead of a hover-and-focus widget. On a platform serving
 * people with disabilities that difference is the whole argument.
 *
 * White, on the canvas, with a hairline across the top and one soft shape behind
 * it. Playroom never goes dark: the direction is a lit room, and a navy slab at
 * the bottom of every page was reading as the end of one site and the start of
 * another.
 *
 * Generated from PUBLIC_NAV, so a route cannot exist without appearing here —
 * and tests/e2e/public/footer.spec.ts walks every link, which makes this the
 * broadest guard in the suite against a route declared but never built.
 */
import Link from 'next/link'
import type { Route } from 'next'
import { PUBLIC_NAV, FOOTER_LEGAL } from '@/lib/public-nav'

export function PublicFooter() {
  return (
    <footer className="relative mt-20 overflow-hidden border-t border-line bg-surface">
      {/* The last soft shape on the page, half off the bottom edge. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -right-24 h-[26rem] w-[26rem] rounded-full bg-brand-tint opacity-40"
      />
      <div className="public-shell relative py-14">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {PUBLIC_NAV.map((section) => (
            <div key={section.href}>
              <h2 className="eyebrow mb-2.5 text-brand-dark">
                <Link
                  // Cast: most of these routes are built in later tasks, so
                  // typedRoutes doesn't know them yet.
                  href={section.href as Route<string>}
                  className="hover:text-ink"
                >
                  {section.label}
                </Link>
              </h2>
              <ul className="flex flex-col gap-1.5">
                {section.children.length === 0 ? (
                  <li>
                    <Link
                      href={section.href as Route<string>}
                      className="text-sm text-muted hover:text-ink hover:underline"
                    >
                      Browse all
                    </Link>
                  </li>
                ) : (
                  section.children.map((child) => (
                    <li key={child.href}>
                      <Link
                        href={child.href as Route<string>}
                        className="inline-flex items-baseline gap-1.5 text-sm text-muted hover:text-ink hover:underline"
                      >
                        {child.label}
                        {child.state === 'soon' && (
                          <span className="badge bg-honey-soft text-honey-deep">SOON</span>
                        )}
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-6 text-xs text-muted">
          <span className="font-semibold text-ink">
            SPLAT Connect — Supporting Play by Adapting Toys
          </span>
          {FOOTER_LEGAL.map((legal) => (
            <Link
              key={legal.href}
              href={legal.href as Route<string>}
              className="hover:text-ink hover:underline"
            >
              {legal.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  )
}
