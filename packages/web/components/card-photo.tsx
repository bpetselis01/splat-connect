/**
 * The photo band at the top of a card, or the placeholder when there is none.
 *
 * Extracted because toy cards, public tutorial cards and dashboard tutorial
 * cards had three copies of it, and a fourth was about to appear. The emoji is
 * decorative — the card's title sits directly underneath and names the thing.
 */
import Image from 'next/image'

export function CardPhoto({ src, alt }: { src: string | null; alt: string }) {
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
      <Image src={src} alt={alt} fill className="object-cover" />
    </div>
  )
}
