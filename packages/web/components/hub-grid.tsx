/**
 * The card grid every hub page uses.
 *
 * This is the component that replaces a dropdown menu: the breadth a menu would
 * have hidden is rendered as a page instead, with room for a sentence per
 * destination that a menu never had.
 *
 * Playroom changed two things about it. The cards take their section's colour
 * rather than all being white, and the first one is wider than the rest — a hub's
 * children are written in order, so the first is the one to read first, and an
 * evenly-weighted grid was hiding that. Uniform card grids were also the site's
 * loudest generated-looking tell.
 *
 * The tilt is decorative and lives on the card, never on this grid: strip every
 * transform and what is left is an ordinary responsive grid in source order.
 */
import Link from 'next/link'
import type { Route } from 'next'
import type { NavItem } from '@/lib/public-nav'
import { toneClass, type Tone } from '@/lib/tone'
import { Tilt } from '@/components/tilt'

export function HubGrid({
  items,
  tone,
  /** Give the first card extra width. Off for lists that are peers, e.g. tracks. */
  leadFirst = true,
}: {
  items: NavItem[]
  /** Omit on mixed lists that do not belong to one section. */
  tone?: Tone
  leadFirst?: boolean
}) {
  if (items.length === 0) return null

  const spec = tone ? toneClass(tone) : undefined
  const wide = leadFirst && items.length > 2

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, i) => (
        <Tilt
          key={item.href}
          index={i}
          className={wide && i === 0 ? 'sm:col-span-2' : undefined}
        >
          <Link
            // Cast: most of these routes are built in later tasks, so
            // typedRoutes doesn't know them yet.
            href={item.href as Route<string>}
            className={`card-playroom card-link flex h-full flex-col rounded-2xl p-5 ${
              spec ? `${spec.surface} ${spec.ink}` : ''
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={`font-bold ${spec ? '' : 'text-ink'}`}>{item.label}</h3>
              {item.state === 'soon' && (
                <span className="badge bg-honey-soft text-honey-deep">SOON</span>
              )}
            </div>
            <p
              className={`mt-1.5 text-sm leading-relaxed ${spec ? 'opacity-90' : 'text-muted'}`}
            >
              {item.blurb}
            </p>
          </Link>
        </Tilt>
      ))}
    </div>
  )
}
