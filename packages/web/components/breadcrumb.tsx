/**
 * Where you are, on pages that sit inside a section.
 *
 * The site is two levels deep, so this is deliberately not a full trail — a
 * `Home / Learn / Switch types` chain would restate the h1 sitting directly
 * beneath it, and breadcrumbs earn their place at three levels, not two. What a
 * visitor actually needs here is the way back up, so that is all this renders.
 *
 * Renders nothing on the homepage or on a section hub: you are already at the
 * top of the tree, and a link pointing at the page you are on is noise.
 *
 * Lives in the layout rather than in each page because the layout is the only
 * place that knows the pathname without threading it through forty files.
 */
import Link from 'next/link'
import type { Route } from 'next'
import { sectionFor } from '@/lib/public-nav'
import { toneClass } from '@/lib/tone'

export function Breadcrumb({ pathname }: { pathname: string }) {
  const section = sectionFor(pathname)
  if (!section || pathname === section.href) return null

  const tone = toneClass(section.tone)

  return (
    <nav aria-label="Breadcrumb" className="mb-5">
      <Link
        href={section.href as Route<string>}
        className="eyebrow inline-flex items-center gap-2 text-brand-dark transition-colors hover:text-brand-deep"
      >
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${tone.dot}`} />
        <span aria-hidden="true">←</span>
        {section.label}
      </Link>
    </nav>
  )
}
