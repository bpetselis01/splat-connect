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
 *
 * A pillar is now a tall tile with a big illustration filling most of it and
 * the section's own mark resting beside its count. The first pass gave
 * pillars the extra width but nothing to fill it with, so three of the
 * site's most important destinations came out as pale rectangles that were
 * mostly empty space.
 */
import Link from 'next/link'
import type { Route } from 'next'
import type { IllustrationKey } from '@/components/editorial-image'
import { toneClass, type Tone } from '@/lib/tone'
import { Slot, Sticker } from '@/components/slot'

export interface LauncherTile {
  href: string
  label: string
  blurb: string
  tone: Tone
  /** The section's illustration, worn by pillar tiles. */
  art: IllustrationKey
  rank: 'pillar' | 'supporting'
  /** Omitted where a number would be meaningless, e.g. About. */
  count?: number
}

export function LauncherGrid({ tiles }: { tiles: LauncherTile[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-12">
      {tiles.map((tile, i) => {
        const pillar = tile.rank === 'pillar'
        const tone = toneClass(tile.tone)

        return (
          <div
            key={tile.href}
            className={pillar ? 'h-full col-span-2 lg:col-span-4' : 'h-full col-span-1 lg:col-span-3'}
          >
            <Link
              // Cast: NavSection.href is `string`, not typedRoutes' `Route` — see
              // lib/public-nav.ts for why.
              href={tile.href as Route<string>}
              className={`card-pixel card-link group relative flex h-full flex-col overflow-hidden ${tone.surface} ${
                pillar ? `card-pixel-lead ${tone.ink} min-h-[22rem] p-5` : `${tone.ink} p-4`
              }`}
            >
              {/*
                The art region, which is most of a pillar.

                It was a small disc hung off the bottom corner, and that is why
                three of the site's most important destinations came out as
                mostly-empty rectangles: a tile whose art is an afterthought in
                the margin has nothing holding its middle. Here the picture is
                the tile's largest element and the words sit beneath it, which
                is the arrangement every one of these tiles was drawn with.
              */}
              {pillar && (
                <Slot
                  kind="art"
                  note={`${tile.label} — isometric scene, one object per product`}
                  className="mb-4 h-[10.5rem] w-full"
                />
              )}

              <p className={`relative font-black ${pillar ? 'text-xl' : 'text-sm'}`}>{tile.label}</p>
              <p
                className={`relative mt-1 leading-snug ${
                  pillar ? 'text-sm opacity-85' : 'text-xs text-muted'
                }`}
              >
                {tile.blurb}
              </p>

              {/* The number is the payoff, so it sits at the bottom where the
                  eye finishes rather than at the top where it competes with the
                  label for the first fixation. On a pillar the section's own
                  mark sits opposite it, closing the row. */}
              <div className="relative mt-auto flex items-end justify-between gap-3 pt-4">
                {tile.count !== undefined ? (
                  <p
                    className={`font-black leading-none tracking-tight ${
                      pillar ? 'title-hero !text-current !text-5xl' : 'text-2xl'
                    }`}
                  >
                    {tile.count}
                  </p>
                ) : (
                  <span
                    aria-hidden="true"
                    className="text-xl font-bold opacity-40 transition-transform duration-200 group-hover:translate-x-1"
                  >
                    →
                  </span>
                )}

                {pillar && (
                  <Sticker
                    art={tile.art}
                    note={`${tile.label} — section mark`}
                    size="sm"
                    className="!h-11 !w-11 !bg-transparent !shadow-none opacity-70"
                  />
                )}
              </div>
            </Link>
          </div>
        )
      })}
    </div>
  )
}
