'use client'
/**
 * The trail back up, drawn the way the board draws it:
 *
 *     ←  ⊞ My SPLAT  /  📄 My tutorials  /  Tutorial editor
 *
 * A muted arrow, then each ancestor as a 14px/800 link with its duotone icon —
 * the nearest in brand, the rest muted — then the page you are on at 13.5px
 * muted. lib/trail.ts decides which pages get one and what is in it; this
 * component only draws it. Pages the trail does not model (most public pages,
 * and every root) render nothing, as on the board.
 *
 * Reads its own pathname via usePathname rather than taking it as a prop from
 * the server layout: the layout only re-reads headers() on a hard page load, so
 * a prop computed there goes stale across any soft <Link> transition.
 *
 * Uses BoundaryLink, not next/link directly: a crumb can point across the
 * public/account boundary, the stale-chrome bug BoundaryLink exists to prevent.
 */
import { usePathname } from 'next/navigation'
import {
  ArrowLeft,
  BookmarkSimple,
  Buildings,
  CalendarCheck,
  CalendarDots,
  ClipboardText,
  FileText,
  Folder,
  Handshake,
  Lightbulb,
  Megaphone,
  Newspaper,
  Package,
  Printer,
  Recycle,
  ShieldCheck,
  SquaresFour,
  Tray,
  type Icon,
} from '@phosphor-icons/react'
import { BoundaryLink } from '@/components/boundary-link'
import { trailFor } from '@/lib/trail'

const ICONS: Record<string, Icon> = {
  'bookmark-simple': BookmarkSimple,
  buildings: Buildings,
  'calendar-check': CalendarCheck,
  'calendar-dots': CalendarDots,
  'clipboard-text': ClipboardText,
  'file-text': FileText,
  handshake: Handshake,
  lightbulb: Lightbulb,
  megaphone: Megaphone,
  newspaper: Newspaper,
  package: Package,
  printer: Printer,
  recycle: Recycle,
  'shield-check': ShieldCheck,
  'squares-four': SquaresFour,
  tray: Tray,
}

export function Breadcrumb() {
  const pathname = usePathname() ?? ''
  const crumbs = trailFor(pathname)
  if (crumbs.length === 0) return null

  const here = crumbs[crumbs.length - 1]
  const up = crumbs.slice(0, -1)

  return (
    <nav aria-label="Breadcrumb" className="crumbs">
      <ArrowLeft weight="bold" aria-hidden="true" className="crumbs__arrow" />
      <ol className="contents">
        {up.map((crumb, i) => {
          const Glyph = ICONS[crumb.icon ?? ''] ?? Folder
          const nearest = i === up.length - 1
          const body = (
            <>
              <Glyph weight="duotone" aria-hidden="true" className="text-base" />
              {crumb.label}
            </>
          )
          return (
            <li key={`${crumb.label}-${i}`} className="contents">
              {crumb.href ? (
                <BoundaryLink
                  href={crumb.href}
                  className={`crumbs__link${nearest ? ' crumbs__link--near' : ''}`}
                >
                  {body}
                </BoundaryLink>
              ) : (
                <span className="crumbs__link">{body}</span>
              )}
              <span aria-hidden="true" className="crumbs__sep">
                /
              </span>
            </li>
          )
        })}
        {/* The current page: aria-current, no href, per WAI-ARIA's breadcrumb pattern. */}
        <li className="contents">
          <span aria-current="page" className="crumbs__here">
            {here.label}
          </span>
        </li>
      </ol>
    </nav>
  )
}
