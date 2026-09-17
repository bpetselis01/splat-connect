/**
 * The media band at the top of a browse card, or its placeholder.
 *
 * From design-system-update/components/cards/ContentCard.jsx: a 150px band
 * filled with the card's tint, and when there is no photo, the card's own
 * duotone glyph at 48px in --b700. It was a 🧸 emoji on brand-tint, which is
 * the one thing on a listing screen you cannot mistake for the design — an
 * emoji renders in the reader's system font and carries none of the palette.
 *
 * Both the emoji and the photo are decorative: every caller renders the thing's
 * name as text directly underneath, so naming it again here is a duplicate
 * announcement. The empty alt is also what stops a broken image from painting
 * that name a second time *inside* the band, underneath whatever badge is
 * overlaid there — which is exactly what it did before.
 */
import Image from 'next/image'
import { Package } from '@phosphor-icons/react/dist/ssr'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'

import { safePhotoSrc } from '@/lib/photo-src'

export function CardPhoto({
  src,
  icon: Glyph = Package,
  tint = 'var(--color-brand-soft)',
}: {
  src: string | null
  /** The card's own glyph, drawn when there is no photo. */
  icon?: PhosphorIcon
  tint?: string
}) {
  const safe = safePhotoSrc(src)
  if (!safe) {
    return (
      <div
        aria-hidden="true"
        className="grid h-[150px] place-items-center text-brand-deep"
        style={{ backgroundColor: tint }}
      >
        <Glyph weight="duotone" size={48} />
      </div>
    )
  }

  return (
    <div className="relative h-[150px] w-full bg-sunken">
      <Image src={safe} alt="" fill className="object-cover" />
    </div>
  )
}
