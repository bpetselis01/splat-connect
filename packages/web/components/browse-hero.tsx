/**
 * The hero card at the top of a browse screen.
 *
 * Ported from the board's #library and #toys: a full-width card rather than a
 * bare h1 over a filter row — 24px radius, --e3, a dot-grid texture masked to
 * an ellipse behind the headline, and an aside in a warm tint carrying the
 * *other* thing you can do here ("Or give — Built one? Write it up.").
 *
 * The texture is the one place Soft Pop keeps a dot grid, and it earns it by
 * being masked: the mask fades it out well before any edge, so it reads as
 * paper rather than as Pixel's hard 16px field.
 *
 * The three figures under the rule are the screen's own counts, passed in. They
 * sit above a hairline rather than in tiles: a stat that needs a box is a stat
 * competing with the headline, and here the headline wins.
 */
import Link from 'next/link'
import type { Route } from 'next'
import type { ReactNode } from 'react'

export interface BrowseStat {
  n: ReactNode
  label: string
}

export function BrowseHero({
  eyebrow,
  title,
  lede,
  primary,
  secondary,
  stats,
  aside,
}: {
  eyebrow: string
  title: string
  lede: string
  /** Anchors the page's own grid; a real href, never a scroll handler. */
  primary: { label: string; href: string; icon: ReactNode }
  secondary?: { label: string; href: Route; icon: ReactNode }
  stats: BrowseStat[]
  aside: {
    kicker: string
    title: string
    body: string
    cta: { label: string; href: Route; icon: ReactNode }
    art?: ReactNode
    /** One of the --t* tokens. The board uses amber on both browse screens. */
    tint?: string
  }
}) {
  return (
    <div className="browse-hero">
      <div aria-hidden="true" className="browse-hero__texture" />

      <div className="browse-hero__copy">
        <p className="eyebrow text-muted">{eyebrow}</p>
        <h1 className="browse-hero__title">{title}</h1>
        <p className="browse-hero__lede">{lede}</p>
        <div className="flex flex-wrap gap-3">
          <a href={primary.href} className="btn btn-primary no-underline">
            {primary.icon}
            {primary.label}
          </a>
          {secondary && (
            <Link href={secondary.href} className="btn btn-quiet btn-lg no-underline">
              {secondary.icon}
              {secondary.label}
            </Link>
          )}
        </div>
        {/* No figures, no rule: an empty ruled row reads as numbers that
            failed to load. /printing has none to show a guest. */}
        {stats.length > 0 && (
          <dl className="browse-hero__stats">
            {stats.map((s) => (
              <div key={s.label} className="min-w-0">
                <dd className="browse-hero__stat-n">{s.n}</dd>
                <dt className="mt-1.5 text-[13px] font-bold text-muted">{s.label}</dt>
              </div>
            ))}
          </dl>
        )}
      </div>

      <aside
        className="browse-hero__aside"
        style={aside.tint ? { backgroundColor: aside.tint } : undefined}
      >
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex min-w-0 flex-col gap-2.5">
            <span className="eyebrow opacity-75">{aside.kicker}</span>
            <h2 className="browse-hero__aside-title">{aside.title}</h2>
          </div>
          {aside.art ? <div className="-mr-2 -mt-2 flex-none">{aside.art}</div> : null}
        </div>
        <p className="max-w-[34ch] text-[15px] leading-[1.55]">{aside.body}</p>
        <Link href={aside.cta.href} className="btn btn-quiet btn-lg mt-auto self-start no-underline">
          {aside.cta.icon}
          {aside.cta.label}
        </Link>
      </aside>
    </div>
  )
}
