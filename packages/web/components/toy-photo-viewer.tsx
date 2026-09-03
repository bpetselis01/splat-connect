'use client'
/**
 * The photos already on file for a toy, shown as pictures rather than URLs —
 * all of them at once, which is what the Review step wants: it is asking you to
 * approve what you uploaded, and a carousel would hide four of the five behind
 * a swipe. The public page shows the same photos in PhotoCarousel instead.
 *
 * There was a second export, ToyPhotoViewer — the same grid in a <dialog>,
 * opened by a "View uploaded photos" button on the Photos tab. The Photos tab
 * is now the tiles themselves (PhotoTiles), so the question that button asked
 * is answered where it is asked.
 */
import Image from 'next/image'

function PhotoTile({ url, caption }: { url: string | null; caption: string }) {
  return (
    <li>
      {url ? (
        <div className="relative h-32 w-full overflow-hidden rounded-lg bg-sunken">
          <Image src={url} alt={caption} fill className="object-cover" />
        </div>
      ) : (
        <div className="flex h-32 w-full items-center justify-center rounded-lg bg-brand-tint text-4xl">
          🧸
        </div>
      )}
      <p className="mt-1 text-xs text-muted">{url ? caption : `No ${caption.toLowerCase()} yet`}</p>
    </li>
  )
}

export function ToyPhotoGrid({
  urls,
  switchUrl,
}: {
  urls: string[]
  switchUrl?: string | null
}) {
  return (
    <ul className="grid grid-cols-2 gap-3">
      {urls.length === 0 && <PhotoTile url={null} caption="Photo" />}
      {urls.map((url, i) => (
        <PhotoTile
          key={url}
          url={url}
          caption={
            // Says what the photo is FOR where that is known, and falls back to
            // its position where it isn't. Both are things a reviewer checking
            // their own listing wants confirmed before they publish it.
            url === switchUrl ? 'Shows the switch' : i === 0 ? 'Cover photo' : `Photo ${i + 1}`
          }
        />
      ))}
    </ul>
  )
}
