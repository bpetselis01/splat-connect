/**
 * The card grid every hub page uses.
 *
 * This is the component that replaces a dropdown menu: the breadth a menu would
 * have hidden is rendered as a page instead, with room for a sentence per
 * destination that a menu never had.
 *
 * Every card carries its section's colour and a rectangular art slot in that
 * section's deep shade, exactly as the board draws them. An earlier pass tinted
 * only the first card and gave the rest white, arguing that a six-card hub all
 * in one hue reads as monotony rather than identity. That was a fair objection
 * to a flat six-card grid and it does not apply: every hub page already splits
 * its children into labelled groups ("Start here" / "Going deeper"), so no grid
 * on this site renders more than four cards. The condition the objection
 * depended on is not there.
 *
 * There is no lead card and no arrow. Both were this component's own additions;
 * the board draws neither, and the group heading above the grid already does
 * the "read this one first" job the wide card was invented for.
 *
 * The grid carries no transform — cards lay out upright, in source order.
 */
import type { NavItem } from '@/lib/public-nav'
import { toneClass, type Tone } from '@/lib/tone'
import { Slot } from '@/components/slot'
import { BoundaryLink } from '@/components/boundary-link'

export function HubGrid({
  items,
  tone,
  columns = 3,
}: {
  items: NavItem[]
  /** Omit on mixed lists that do not belong to one section. */
  tone?: Tone
  /**
   * The board draws two widths: 3-up for a section's primary groups, 4-up for
   * the "more in this section" tail. The card's art slot, title and blurb all
   * step down a size at 4-up, which is why this is one prop rather than three.
   */
  columns?: 3 | 4
}) {
  if (items.length === 0) return null

  const spec = tone ? toneClass(tone) : undefined
  const wide = columns === 3

  return (
    <div
      className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${
        wide ? 'lg:grid-cols-3' : 'lg:grid-cols-4'
      }`}
    >
      {items.map((item) => (
        <BoundaryLink
          key={item.href}
          href={item.href}
          className={`card-pixel card-link flex h-full flex-col gap-1.5 ${
            wide ? 'p-[18px]' : 'p-4'
          } ${spec ? `${spec.surface} ${spec.ink}` : ''}`}
        >
          <Slot
            kind="art"
            tone={tone}
            note={`${item.label} — one object, no background`}
            className={`mb-1 w-full ${wide ? 'h-[7.5rem]' : 'h-[6.25rem]'}`}
          />

          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`font-extrabold ${wide ? 'text-[15px]' : 'text-[14px]'}`}>
              {item.label}
            </h3>
            {item.state === 'soon' && (
              // The board's four-character SOON, at the size it was drawn:
              // .badge defaults to 11px for the multi-word labels every other
              // caller carries, but this is the one label 9px fits.
              <span className="badge bg-honey-soft text-honey-deep text-[9px]">SOON</span>
            )}
          </div>

          {/* Always muted, never the tone's own ink: the board keeps the blurb
              at #4d6a7d on every section so the title is the only coloured
              thing in the card and reads first. */}
          <p
            className={`leading-relaxed text-muted ${
              wide ? 'text-[13px]' : 'text-[12px]'
            }`}
          >
            {item.blurb}
          </p>
        </BoundaryLink>
      ))}
    </div>
  )
}
