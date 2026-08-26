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
 * White, on the canvas, with one soft shape behind it. The design never goes
 * dark: the canvas stays lit, and a navy slab at the bottom of every page was
 * reading as the end of one site and the start of another.
 *
 * The top edge is the same 3px ink rule the nav shelf carries, not the hairline
 * it used to be. Those two rules are the page's frame — a heavy line closing the
 * top of the page and a hairline closing the bottom left the site looking like
 * it had come loose at the bottom of the screen.
 *
 * Generated from PUBLIC_NAV, so a route cannot exist without appearing here —
 * and tests/e2e/public/footer.spec.ts walks every link, which makes this the
 * broadest guard in the suite against a route declared but never built.
 */
import { PUBLIC_NAV, FOOTER_LEGAL } from '@/lib/public-nav'
import { BoundaryLink } from '@/components/boundary-link'

export function PublicFooter() {
  return (
    <footer className="relative mt-20 overflow-hidden border-t-[3px] border-ink bg-surface">
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
                <BoundaryLink href={section.href} className="hover:text-ink">
                  {section.label}
                </BoundaryLink>
              </h2>
              <ul className="flex flex-col gap-1.5">
                {section.children.length === 0 ? (
                  <li>
                    <BoundaryLink
                      href={section.href}
                      className="text-sm text-muted hover:text-ink hover:underline"
                    >
                      Browse all
                    </BoundaryLink>
                  </li>
                ) : (
                  section.children.map((child) => (
                    <li key={child.href}>
                      <BoundaryLink
                        href={child.href}
                        className="inline-flex items-baseline gap-1.5 text-sm text-muted hover:text-ink hover:underline"
                      >
                        {child.label}
                        {child.state === 'soon' && (
                          <span className="badge bg-honey-soft text-honey-deep text-[9px]">SOON</span>
                        )}
                      </BoundaryLink>
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
            <BoundaryLink
              key={legal.href}
              href={legal.href}
              className="hover:text-ink hover:underline"
            >
              {legal.label}
            </BoundaryLink>
          ))}
        </div>
      </div>
    </footer>
  )
}
