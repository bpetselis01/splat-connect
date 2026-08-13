'use client'
/**
 * The photos already on file for a toy, shown as pictures rather than URLs.
 *
 * Two exports because there are two needs. Review wants the photos in the page
 * next to the fields it is asking you to approve, so it renders the grid
 * directly. The Photos tab is already a column of dropzones and would be
 * pushed around by a second set of images, so it gets the dialog instead.
 *
 * Dialog mechanics are delete-entity-button.tsx's: a native <dialog> driven by
 * showModal()/close() from an effect, so the focus trap, Escape and the inert
 * background all come from the platform.
 */
import { useEffect, useRef, useState } from 'react'
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

export function ToyPhotoViewer({
  coverPhotoUrl,
  switchPhotoUrls,
}: {
  coverPhotoUrl: string | null
  switchPhotoUrls: string[]
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const hasPhotos = coverPhotoUrl !== null || switchPhotoUrls.length > 0

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!hasPhotos}
        className="btn btn-soft"
      >
        View uploaded photos
      </button>

      <dialog
        ref={ref}
        className="dialog-panel"
        onCancel={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === ref.current) setOpen(false)
        }}
      >
        <div onClick={(e) => e.stopPropagation()} className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-ink">Uploaded photos</h2>
          <ToyPhotoGrid coverPhotoUrl={coverPhotoUrl} switchPhotoUrls={switchPhotoUrls} />
          <div className="flex justify-end">
            <button type="button" onClick={() => setOpen(false)} className="btn btn-soft">
              Close
            </button>
          </div>
        </div>
      </dialog>
    </>
  )
}
