/**
 * The homepage's section launcher.
 *
 * This is the fast path, and the reason the site needs no dropdown menus: a
 * visitor who knows where they are going leaves from here without scrolling, and
 * a stranger reads the whole site's shape and scale in one glance.
 *
 * It used to render six identical tiles in a six-column grid, which told that
 * stranger the wrong thing. SPLAT provides three things — adaptation guides, the
 * toy library, and 3D printed parts — and everything else exists to explain,
 * recruit for or account for those three. So pillars are wide and carry their
 * own colour; supporting sections are narrow and quiet. The size difference is
 * information, not decoration.
 *
 * The twelve-column track is what makes both rows come out even: three pillars
 * at four columns, four supporting sections at three.
 */
import Link from 'next/link'
import type { Route } from 'next'
import { toneClass, type Tone } from '@/lib/tone'
import { Tilt } from '@/components/tilt'

export interface LauncherTile {
  href: string
  label: string
  blurb: string
  tone: Tone
  rank: 'pillar' | 'supporting'
  /** Omitted where a number would be meaningless, e.g. About. */
  count?: number
}

export function LauncherGrid({ tiles }: { tiles: LauncherTile[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-12">
      {tiles.map((tile, i) => {
        const pillar = tile.rank === 'pillar'
        const tone = toneClass(tile.tone)

        return (
          <Tilt
            key={tile.href}
            index={i}
            className={pillar ? 'col-span-2 lg:col-span-4' : 'col-span-1 lg:col-span-3'}
          >
            <Link
              // Cast: NavSection.href is `string`, not typedRoutes' `Route` — see
              // lib/public-nav.ts for why.
              href={tile.href as Route<string>}
              className={`card-playroom card-link flex h-full flex-col rounded-2xl ${
                pillar ? `${tone.surface} ${tone.ink} p-5` : 'bg-surface p-4 text-ink'
              }`}
            >
              {tile.count !== undefined && (
                <p
                  className={`font-bold leading-none ${
                    pillar ? 'text-3xl' : 'text-xl text-brand-deep'
                  }`}
                >
                  {tile.count}
                </p>
              )}
              <p className={`font-bold ${pillar ? 'mt-2 text-lg' : 'mt-1.5 text-sm'}`}>
                {tile.label}
              </p>
              <p
                className={`mt-1 leading-snug ${
                  pillar ? 'text-sm opacity-90' : 'text-xs text-muted'
                }`}
              >
                {tile.blurb}
              </p>
            </Link>
          </Tilt>
        )
      })}
    </div>
  )
}
