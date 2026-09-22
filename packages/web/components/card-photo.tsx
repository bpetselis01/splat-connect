/**
 * The media band at the top of a browse card, or its placeholder.
 *
 * From design-system-update/components/cards/ContentCard.jsx and the board's
 * own #home rows: a 4:3 band filled with the card's tint, and when there is no
 * photo, the card's own duotone glyph at 64px in ink at 70%. The band was a
 * fixed 150px, which made a two-up row of cards on a wide column draw a letter-
 * box where the board draws a picture. It was a 🧸 emoji on brand-tint, which is
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

/** The board tints each card differently — blue, amber, coral, violet, mint —
 *  rather than giving a whole grid one colour. With no per-item colour in the
 *  data, the id picks one, so a card keeps its tint across visits. */
const TINTS = ['var(--b100)', 'var(--tamber)', 'var(--tcoral)', 'var(--tviolet)', 'var(--tmint)']

export function tintFor(id: string): string {
  let sum = 0
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i)
  return TINTS[sum % TINTS.length]
}

export function CardPhoto({
  src,
  icon: Glyph = Package,
  tint = 'var(--color-brand-soft)',
  iconSize = 64,
  children,
}: {
  src: string | null
  /** The card's own glyph, drawn when there is no photo. */
  icon?: PhosphorIcon
  tint?: string
  /** 72 on a browse grid, 64 in the home page's two-up rows — the board's. */
  iconSize?: number
  /** Overlaid on the band, e.g. a toy's availability pill. */
  children?: React.ReactNode
}) {
  const safe = safePhotoSrc(src)
  if (!safe) {
    return (
      <div
        className="relative grid aspect-[4/3] place-items-center"
        style={{ backgroundColor: tint, color: 'var(--tink)' }}
      >
        <Glyph weight="duotone" size={iconSize} opacity={0.7} aria-hidden="true" />
        {children}
      </div>
    )
  }

  return (
    <div className="relative aspect-[4/3] w-full bg-sunken">
      <Image src={safe} alt="" fill className="object-cover" />
      {children}
    </div>
  )
}
