/**
 * The photo band at the top of a card, or the placeholder when there is none.
 *
 * Extracted because toy cards, public tutorial cards and dashboard tutorial
 * cards had three copies of it, and a fourth was about to appear.
 *
 * Both the emoji and the photo are decorative: every caller renders the thing's
 * name as text directly underneath, so naming it again here is a duplicate
 * announcement. The empty alt is also what stops a broken image from painting
 * that name a second time *inside* the band, underneath whatever badge is
 * overlaid there — which is exactly what it did before.
 */
import Image from 'next/image'

export function CardPhoto({ src }: { src: string | null }) {
  if (!src) {
    return (
      <div
        aria-hidden="true"
        className="flex h-36 items-center justify-center bg-brand-tint text-4xl"
      >
        🧸
      </div>
    )
  }

  return (
    <div className="relative h-36 w-full bg-sunken">
      <Image src={src} alt="" fill className="object-cover" />
    </div>
  )
}
