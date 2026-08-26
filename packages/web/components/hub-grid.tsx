/**
 * The card grid every hub page uses.
 *
 * This is the component that replaces a dropdown menu: the breadth a menu would
 * have hidden is rendered as a page instead, with room for a sentence per
 * destination that a menu never had.
 *
 * Pixel changed two things about it. The cards take their section's colour
 * rather than all being white, and the first one is wider than the rest — a hub's
 * children are written in order, so the first is the one to read first, and an
 * evenly-weighted grid was hiding that. Uniform card grids were also the site's
 * loudest generated-looking tell.
 *
 * The grid itself carries no transform of its own — cards lay out in an
 * ordinary responsive grid, upright, in source order.
 *
 * The lead card is not just wider now, it is set in the display face at article
 * size. Width alone was not carrying the "read this one first" job — a wide card
 * with the same 16px bold title as its neighbours just looked like a card that
 * had run out of things to say.
 *
 * Only the lead card is filled with the section's colour. Giving every card the
 * tone turned a hub into a wall of one hue — six honey rectangles on Learn, six
 * mint ones on Toy Library — which is monotony rather than identity. One filled
 * card against white siblings that carry the tone in their type reads as a
 * section *and* as a hierarchy, for the same number of colours.
 */
import type { NavItem } from '@/lib/public-nav'
import type { IllustrationKey } from '@/components/editorial-image'
import { toneClass, type Tone } from '@/lib/tone'
import { Sticker } from '@/components/slot'
import { BoundaryLink } from '@/components/boundary-link'

export function HubGrid({
  items,
  tone,
  art,
  /** Give the first card extra width. Off for lists that are peers, e.g. tracks. */
  leadFirst = true,
}: {
  items: NavItem[]
  /** Omit on mixed lists that do not belong to one section. */
  tone?: Tone
  /**
   * The section's illustration. The lead card wears it; the rest carry an
   * unfilled sticker slot, because a hub whose every card showed the same
   * drawing would be a wall of one picture rather than a set of destinations.
   */
  art?: IllustrationKey
  leadFirst?: boolean
}) {
  if (items.length === 0) return null

  const spec = tone ? toneClass(tone) : undefined
  // Colour and width are two separate jobs, and conflating them is what broke
  // this. The first card always takes the section's fill — that is the "read
  // this one first" signal. It only takes extra *width* when there are more than
  // three cards to share the row with: at exactly three the row is already full,
  // and promoting the lead there produced a box two columns wide and two rows
  // tall holding one sentence. Three equal cards in a row is the shape the
  // direction was drawn around.
  const wide = leadFirst && items.length > 3

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, i) => {
        const lead = leadFirst && i === 0
        const spread = wide && i === 0

        return (
          <div key={item.href} className={spread ? 'h-full sm:col-span-2' : 'h-full'}>
            <BoundaryLink
              href={item.href}
              className={`card-pixel card-link group relative flex h-full flex-col overflow-hidden p-5 ${
                spread ? 'sm:p-8' : ''
              } ${
                spec
                  ? lead
                    ? `${spec.surface} ${spec.ink}`
                    : `bg-surface ${spec.ink}`
                  : ''
              }`}
            >
              {/* Above the title, exactly where the mockup's photo slot sits.
                  Round rather than a 3:2 rectangle: six dashed rectangles on a
                  six-card hub reads as six broken images, where six small discs
                  read as a set of stamps. */}
              {(art || spec) && (
                <Sticker
                  art={lead ? art : undefined}
                  note={
                    lead
                      ? `${item.label} — section illustration`
                      : `${item.label} — small sticker, one object, no background`
                  }
                  size={spread ? 'lg' : 'sm'}
                  className="mb-3"
                />
              )}

              <div className="flex flex-wrap items-center gap-2">
                <h3
                  className={
                    spread
                      ? 'title-article !text-current'
                      : `font-black ${spec ? '' : 'text-ink'}`
                  }
                >
                  {item.label}
                </h3>
                {item.state === 'soon' && (
                  <span className="badge bg-honey-soft text-honey-deep">SOON</span>
                )}
              </div>
              <p
                className={`mt-2 leading-relaxed ${
                  spread ? 'max-w-[42ch] text-lg' : 'text-sm'
                } ${lead && spec ? 'opacity-90' : 'text-muted'}`}
              >
                {item.blurb}
              </p>

              {/* Pushed to the bottom so every card in a row ends on the same
                  line however ragged the blurbs are — the cheapest thing that
                  makes the grid read as deliberate rather than accidental. */}
              <span
                aria-hidden="true"
                className={`relative mt-auto font-bold opacity-50 transition-transform duration-200 group-hover:translate-x-1.5 ${
                  spread ? 'pt-8 text-4xl' : 'pt-5 text-2xl'
                }`}
              >
                →
              </span>
            </BoundaryLink>
          </div>
        )
      })}
    </div>
  )
}
