/**
 * The image slot for editorial pages — homepage, Learn, Get Involved, About.
 *
 * Guides and toys carry photos their makers uploaded, with consent inside the
 * upload flow (components/card-photo.tsx handles those). Editorial pages have no
 * such source, so a flat brand illustration holds each slot until the team's own
 * workshop photographs exist. Filling in `src` is then the entire change: the
 * ratio is already fixed, so a real photo cannot reflow the page around it.
 *
 * Decorative in both states, like CardPhoto: every slot sits beside a heading
 * that already names the subject.
 *
 * The placeholder state is not a flat tinted box any more. At 2/1 on a wide
 * page that box was ~760px of pale blue holding a 200px line drawing, which
 * read as an image that had failed to load. The illustration now sits on the
 * site's switch motif — two rings and a white cap — so the slot is a deliberate
 * graphic at any size. The photo state is untouched: `src` still fills the same
 * fixed ratio edge to edge, so swapping one in is still the entire change.
 */
import Image from 'next/image'

export type IllustrationKey =
  | 'adapted-toy'
  | 'switch'
  | 'printer'
  | 'family'
  | 'maker'
  | 'organisation'
  | 'bear-on-shelf'

export type ImageRatio = '3/2' | '2/1' | '1/1'

const RATIO_CLASS: Record<ImageRatio, string> = {
  '3/2': 'aspect-[3/2]',
  '2/1': 'aspect-[2/1]',
  '1/1': 'aspect-square',
}

/**
 * A ceiling on how wide a slot may grow, applied to the figure so the aspect box
 * shrinks with it and the ratio still holds.
 *
 * Without this, 2/1 spanned the full 6xl content column: a ~1060px band of flat
 * tint with one small illustration adrift in the middle of it, on six pages. The
 * cap applies in the photo state too, so a real image lands at exactly the size
 * the placeholder reserved and "filling in `src` is the entire change" stays
 * true — which is the only reason the ratio is fixed here in the first place.
 */
const MAX_WIDTH: Record<ImageRatio, string> = {
  '3/2': 'max-w-md',
  '2/1': 'max-w-lg',
  '1/1': '',
}

export function EditorialImage({
  src,
  illustration,
  ratio,
  caption,
}: {
  /** A real, consented photograph once one exists. */
  src?: string | null
  illustration: IllustrationKey
  ratio: ImageRatio
  /** Credit line. Rendered only alongside a real photo. */
  caption?: string
}) {
  const isPhoto = Boolean(src)

  return (
    <figure className={`m-0 ${MAX_WIDTH[ratio]}`.trim()}>
      <div
        data-ratio={ratio}
        // The unfilled state is drawn as a slot rather than as a picture: tinted
        // fill, 2px dashed brand edge, illustration floating inside it. The dash
        // is doing real work — it says "an image belongs here and there isn't one
        // yet", which a solid frame around a flat illustration does not, and it
        // is the same slot the mockups mark every photo position with. Filling in
        // `src` swaps the whole treatment for the photo.
        className={`relative w-full overflow-hidden ${RATIO_CLASS[ratio]} ${
          isPhoto
            ? 'rounded-[14px] bg-sunken'
            : 'rounded-xl border-2 border-dashed border-brand bg-brand-tint'
        }`}
      >
        <Image
          src={src || `/illustrations/${illustration}.svg`}
          alt=""
          fill
          className={isPhoto ? 'object-cover' : 'object-contain p-[9%]'}
        />
      </div>
      {isPhoto && caption && (
        <figcaption className="mt-2 text-xs text-muted">{caption}</figcaption>
      )}
    </figure>
  )
}
