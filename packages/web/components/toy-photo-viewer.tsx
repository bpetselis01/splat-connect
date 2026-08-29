'use client'
/**
 * The photos already on file for a toy, shown as pictures rather than URLs.
 * Rendered by the Review step, next to the fields it is asking you to approve.
 *
 * There was a second export, ToyPhotoViewer — the same grid in a <dialog>,
 * opened by a "View uploaded photos" button on the Photos tab, because that
 * tab is a column of dropzones and would have been pushed around by a second
 * set of images. FileDropZone shows the photo on file in place now, so the
 * question that button answered is answered where it is asked, and a modal
 * for looking at your own upload is a lot of machinery for that.
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
  coverPhotoUrl,
  switchPhotoUrls,
}: {
  coverPhotoUrl: string | null
  switchPhotoUrls: string[]
}) {
  return (
    <ul className="grid grid-cols-2 gap-3">
      <PhotoTile url={coverPhotoUrl} caption="Cover photo" />
      {/* Uploading now writes a single switch photo, but toys created before
          that still hold several. Show every one rather than hiding the extras
          — the next upload collapses them to one. */}
      {switchPhotoUrls.map((url, i) => (
        <PhotoTile
          key={url}
          url={url}
          caption={switchPhotoUrls.length > 1 ? `Switch photo ${i + 1}` : 'Switch photo'}
        />
      ))}
    </ul>
  )
}
