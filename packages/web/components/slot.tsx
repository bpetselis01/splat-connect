/**
 * Reserved space for the art that hasn't been made yet.
 *
 * The public site is designed around a playful visual layer — stickers pinned to
 * cards, an overlay behind the hero, a switch that animates when you press it —
 * and none of that art exists. The choice is between designing as if it were
 * already there (and shipping a site with holes in it) or leaving the holes
 * marked. This marks them.
 *
 * A marked hole is a deliverable, not a defect. Every slot below carries a
 * `note` describing what belongs in it, so the person who eventually draws the
 * sticker is briefed by the page itself rather than by a document that has drifted
 * from it. That is the same argument `EditorialImage` already makes for
 * photographs, and this is the rest of the set: EditorialImage owns the big
 * rectangular image slots, `Sticker` owns the small decorative ones, and `Slot`
 * owns regions that will hold an animation or an overlay rather than a picture.
 *
 * All three are decoration, and are treated as such throughout: `aria-hidden` so
 * a screen reader never meets an unbuilt asset, and `pointer-events-none` so a
 * sticker pinned over a card can never swallow the click or the focus ring
 * belonging to the link underneath it.
 *
 * Set NEXT_PUBLIC_SLOTS=off to hide every unfilled Sticker and Slot without
 * touching a page. Placeholders that cannot be switched off are how dashed boxes
 * end up in front of real families, so the off switch ships with the first
 * placeholder rather than after the incident. Two things the flag deliberately
 * does not reach: a sticker that has real art in it, because that is the
 * finished state rather than a placeholder, and `EditorialImage`, which already
 * owns its own unfilled treatment and falls back to a brand illustration rather
 * than to nothing.
 */
import Image from 'next/image'
import type { IllustrationKey } from '@/components/editorial-image'

/** What the finished asset will be. Drives the label, and nothing else. */
export type SlotKind = 'sticker' | 'overlay' | 'animation'

const KIND_LABEL: Record<SlotKind, string> = {
  sticker: 'Sticker',
  overlay: 'Overlay',
  animation: 'Animation',
}

/** Unfilled slots are visible by default: the point of them is to be seen. */
export const SLOTS_VISIBLE = process.env.NEXT_PUBLIC_SLOTS !== 'off'

/**
 * A small decorative chip: a tilted disc pinned to a corner of something else.
 *
 * Filled with one of the brand illustrations it is finished art. Unfilled it is
 * a dashed disc carrying its brief. Either way it is the same size and in the
 * same place, so dropping the real sticker in never moves the page.
 *
 * Circular rather than rectangular on purpose — the site's photo slots are all
 * rectangles, so a round chip is legible as a different kind of thing at a
 * glance, and it echoes the switch the whole charity is built around.
 */
export function Sticker({
  art,
  note,
  size = 'md',
  className = '',
}: {
  /** A brand illustration, when one suits. Omit for a slot awaiting custom art. */
  art?: IllustrationKey
  /** The brief: what this sticker should eventually be. */
  note: string
  size?: 'sm' | 'md' | 'lg'
  /** Positioning is the caller's job — this component never places itself. */
  className?: string
}) {
  if (!art && !SLOTS_VISIBLE) return null

  // Empty slots are brand-blue and dashed on every section, deliberately not
  // tinted to the tone they sit in. A placeholder's first job is to be legible
  // as a placeholder, and one that camouflages itself into each section is a
  // placeholder that ships.
  const box = size === 'sm' ? 'h-16 w-16' : size === 'lg' ? 'h-28 w-28' : 'h-20 w-20'

  return (
    <span
      aria-hidden="true"
      title={note}
      className={`pointer-events-none grid shrink-0 place-items-center overflow-hidden rounded-full ${box} ${
        art
          // White, not the section tint: a filled sticker is most often pinned to
          // a card that already carries the tone, and tint-on-tint made the art
          // float with no disc under it at all.
          ? 'bg-surface shadow-[0_3px_0_rgb(10_53_80/0.10)]'
          : 'border-2 border-dashed border-brand bg-brand-tint text-brand-deep'
      } ${className}`.trim()}
    >
      {art ? (
        <Image
          src={`/illustrations/${art}.svg`}
          alt=""
          width={112}
          height={112}
          className="h-[78%] w-[78%] object-contain"
        />
      ) : (
        // Three letters, because the disc is 64px across and the word "sticker"
        // set in mono with the tracking these labels carry is wider than that.
        // The full brief rides in the title attribute instead — a slot that
        // overflows its own label is worse than one that just marks itself.
        <span className="meta leading-none">ART</span>
      )}
    </span>
  )
}

/**
 * A rectangular region held for an animation or an overlay.
 *
 * Unlike a sticker this has no finished state to fall back on — an animation
 * either exists or it does not — so it renders only while slots are visible and
 * disappears cleanly when they are switched off. Callers therefore have to
 * position it absolutely over content that stands on its own without it.
 */
export function Slot({
  kind,
  note,
  className = '',
}: {
  kind: Exclude<SlotKind, 'sticker'>
  /** The brief: what belongs here, in a few words. */
  note: string
  className?: string
}) {
  if (!SLOTS_VISIBLE) return null

  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-brand bg-brand-tint/60 p-3 text-center text-brand-deep ${className}`.trim()}
    >
      <span className="meta">{KIND_LABEL[kind]}</span>
      <span className="max-w-[22ch] text-[11px] leading-tight opacity-85">{note}</span>
    </span>
  )
}
