/**
 * The card grid every hub page uses.
 *
 * This is the component that replaces a dropdown menu: the breadth a menu would
 * have hidden is rendered as a page instead, with room for a sentence per
 * destination that a menu never had.
 *
 * The card is --surface and the SECTION'S COLOUR lives in its art band, which
 * is how the board draws it: `background:var(--surface)` on the article, a
 * 150px tinted block at the top of it. Both were wrong here. The tint was on
 * the whole card, so a hub read as a wall of one flat colour; and the art band
 * was a dashed MediaSlot, which announces "a photograph is missing" on six
 * pages where nothing is missing — the section's own glyph is the art.
 *
 * MediaSlot is still right where a real photograph is coming and has not
 * arrived. It is not right for a card whose picture is a category.
 *
 * There is no lead card and no arrow. Both were this component's own additions;
 * the board draws neither, and the group heading above the grid already does
 * the "read this one first" job the wide card was invented for.
 *
 * The grid carries no transform — cards lay out upright, in source order.
 */
import type { NavItem } from '@/lib/public-nav'
import { NavIcon } from '@/components/nav-icon'
import { toneClass, type Tone } from '@/lib/tone'
import { BoundaryLink } from '@/components/boundary-link'

export function HubGrid({
  items,
  tone,
  columns = 3,
  variant = 'art',
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
  /**
   * 'art'  — a public hub card: tinted, with a full-width illustration slot.
   * 'tile' — a My SPLAT card: white, with a 40px tinted icon tile and no
   *          artwork at all.
   *
   * A variant rather than a second component because everything below the top
   * of the card — title, SOON badge, count, blurb, the boundary-link behaviour
   * — is identical, and the dashboard is the only caller that differs. A fork
   * would have duplicated all of it to change one element.
   */
  variant?: 'art' | 'tile'
}) {
  if (items.length === 0) return null

  const spec = tone ? toneClass(tone) : undefined
  const wide = columns === 3
  const tiles = variant === 'tile'
  const tileTint = spec?.hex.bg ?? 'var(--b100)'

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
          className={`card card-link flex h-full flex-col ${
            tiles ? 'p-5' : wide ? 'gap-3 p-7' : 'gap-2 p-5'
          }`}
        >
          {tiles ? (
            /* The board's tile head: a 44px square on the left and whatever is
               true of this card on the right. The count used to sit inline with
               the title, where a two-digit number pushed the label onto a second
               line on half the grid. */
            <span className="mb-3 flex items-center justify-between">
              <span
                aria-hidden="true"
                className="grid h-11 w-11 place-items-center rounded-[var(--radius-field)]"
                style={{ background: item.tint ?? tileTint, color: 'var(--tink)' }}
              >
                <NavIcon name={item.icon} size={24} />
              </span>
              {item.count ? (
                <span className="rounded-pill bg-apricot px-[9px] py-0.5 text-xs font-extrabold text-ink">
                  {item.count}
                </span>
              ) : item.state === 'soon' ? (
                <span className="text-[10px] font-extrabold tracking-[0.09em] text-muted">SOON</span>
              ) : null}
            </span>
          ) : (
            /* The board's art band: 150px, the section's tint, radius 18. The
               glyph is decorative — the title is directly underneath it. */
            <span
              aria-hidden="true"
              className={`grid place-items-center rounded-[var(--radius-inset)] ${
                wide ? 'h-[150px]' : 'h-[110px]'
              }`}
              style={{ background: tileTint, color: 'var(--tink)' }}
            >
              <NavIcon name={item.icon} size={wide ? 44 : 36} />
            </span>
          )}

          <div className={`flex flex-wrap items-center gap-2 ${tiles ? 'mb-1' : ''}`}>
            <h3
              className={
                tiles
                  ? 'font-display text-lg font-extrabold leading-[1.3] text-ink'
                  : wide
                  ? 'font-display text-[26px] font-extrabold leading-[1.15] tracking-[-0.015em] text-ink'
                  : 'card-title-grid'
              }
            >
              {item.label}
            </h3>
            {!tiles && item.state === 'soon' && (
              // The board's four-character SOON, at the size it was drawn:
              // .badge defaults to 11px for the multi-word labels every other
              // caller carries, but this is the one label 9px fits.
              <span className="badge bg-honey-soft text-ink text-[9px]">SOON</span>
            )}
            {/* Apricot, the board's one warm accent, so the number reads before
                the title on the only cards that carry one. Nothing at zero: a
                grey 0 is noise that trains you to ignore the badge.

                Three overrides on .badge, all of them what the signposts mockup
                drew: ml-auto pins it to the card's right edge so every number
                down the grid sits on one vertical line, and 2px/10px is the
                weight it was drawn at. .badge's own 1px hairline is a step
                lighter than every other ink border on the card, which is the
                one thing an alert count should not be. */}
            {!tiles && item.count ? (
              <span className="badge ml-auto bg-apricot text-[10px] text-ink">{item.count}</span>
            ) : null}
          </div>

          {/* Always muted, never the tone's own ink: the board keeps the blurb
              at #4d6a7d on every section so the title is the only coloured
              thing in the card and reads first.

              My SPLAT's cards list what is behind them, and for a while that
              list rendered as tinted tags. Removed 2026-08-28: button-shaped
              and inside a link, they read as controls that did not control
              anything — which is the failure the spec's own risk note predicted
              and the fallback it named. A comma list is the same information
              with no false affordance, and one element instead of a branch. */}
          <p
            className={`text-muted ${
              wide ? 'text-base leading-[1.55]' : tiles ? 'text-[13px] leading-[1.5]' : 'text-sm leading-[1.5]'
            }`}
          >
            {item.blurb}
          </p>
        </BoundaryLink>
      ))}
    </div>
  )
}
