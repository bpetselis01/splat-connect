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
    <figure className="m-0">
      <div
        data-ratio={ratio}
        className={`relative w-full overflow-hidden rounded-[14px] ${RATIO_CLASS[ratio]} ${
          isPhoto ? 'bg-sunken' : 'bg-brand-tint'
        }`}
      >
        <Image
          src={src || `/illustrations/${illustration}.svg`}
          alt=""
          fill
          className={isPhoto ? 'object-cover' : 'object-contain p-4'}
        />
      </div>
      {isPhoto && caption && (
        <figcaption className="mt-2 text-xs text-muted">{caption}</figcaption>
      )}
    </figure>
  )
}
