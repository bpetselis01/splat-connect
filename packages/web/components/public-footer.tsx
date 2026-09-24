/**
 * The footer: the brand, two promises, and five curated columns — the board's
 * footer, not the full sitemap it replaced.
 *
 * It used to be generated from PUBLIC_NAV so that every route was one click
 * from every page. The board draws a shorter, hand-picked list instead (the
 * three pillars already sit in the header on every page), and board wins on
 * design. The columns are literal for the same reason the board's are: their
 * labels are not the nav's ("Find a printer", "Safe handling", "Community
 * impact"). tests/e2e/public/footer.spec.ts walks whatever is listed here, so
 * a typo'd href still fails loudly.
 *
 * White, on the canvas, under a hairline. The design never goes dark: a navy
 * slab at the bottom of every page read as the end of one site and the start
 * of another.
 */
import { SealCheck, Heart } from '@phosphor-icons/react/dist/ssr'
import { FOOTER_COLUMNS } from '@/lib/public-nav'
import { BoundaryLink } from '@/components/boundary-link'
import { BrandMark } from '@/components/auth-wordmark'

export { FOOTER_COLUMNS }

export function PublicFooter() {
  return (
    <footer className="site-footer">
      <div className="public-shell site-footer__grid">
        <div>
          <div className="flex items-center gap-2.5">
            <BrandMark />
            <span className="font-display text-[22px] font-extrabold text-ink">
              SPLAT <span className="text-brand-dark">Connect</span>
            </span>
          </div>
          <p className="site-footer__blurb">
            Supporting Play by Adapting Toys. A free, volunteer-run platform in Australia. Not a
            medical device.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="site-footer__promise bg-[var(--tok)]">
              <SealCheck weight="fill" aria-hidden="true" /> Guides reviewed
            </span>
            <span className="site-footer__promise bg-[var(--tamber)]">
              <Heart weight="fill" aria-hidden="true" /> No paid tier
            </span>
          </div>
        </div>

        <div className="site-footer__cols">
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.heading}>
              <h2 className="site-footer__heading">{col.heading}</h2>
              <ul className="flex flex-col gap-2 leading-normal">
                {col.rows.map((row) => (
                  <li key={row.href}>
                    <BoundaryLink href={row.href} className="site-footer__link">
                      {row.label}
                    </BoundaryLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="site-footer__legal">
          © {new Date().getFullYear()} SPLAT Connect · Supporting Play by Adapting Toys · An
          information platform, not a medical device.
        </p>
      </div>
    </footer>
  )
}
