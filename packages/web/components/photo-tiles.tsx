'use client'
/**
 * The one upload box. A toy had two — a cover dropzone and a switch-photo
 * dropzone — and a guide had one that replaced its single photo on every
 * upload. Both are this: a row of tiles plus an Add photo tile, up to
 * MAX_PHOTOS of them.
 *
 * Photos save as they are added, unlike the PDF beside this on the guide's
 * Files step, which is held until Save. The reason that rule exists (a picked
 * file uploading before the person had committed to it) does not apply to a
 * gallery: the tile IS the commitment, and × is how you take it back — which
 * also deletes the object, so nothing is kept that the owner removed.
 *
 * The last photo cannot be removed. The api refuses that save too, but a ×
 * that only fails when pressed teaches nothing — so it is disabled here and
 * the hint below says why, and the api's 400 is the backstop rather than the
 * explanation.
 *
 * Order is upload order and the first photo is the cover; ★ promotes one to
 * the front. Deliberately not drag-to-reorder: with five photos the only
 * question anyone asks is which one leads, and a drag affordance would have
 * cost a gesture dependency on mobile to answer it.
 *
 * Dragging files IN is a different matter — the two dropzones this replaced
 * both took a drop, and losing that was an accident of the rewrite rather
 * than a decision. Several at once, trimmed to the free slots, because that
 * is what someone with five photos in a folder does.
 */
import { useState } from 'react'
import Image from 'next/image'
import { MAX_PHOTOS } from '@splat-connect/types'
import { useToast } from '@/components/toast'

export type PhotoSave = { photo_urls: string[]; switch_photo_url?: string | null }

export function PhotoTiles({
  urls,
  switchUrl,
  upload,
  onSave,
  idPrefix,
}: {
  urls: string[]
  /** Undefined turns the switch column off — a guide has no switch to picture. */
  switchUrl?: string | null
  /** Sends the bytes and returns the stored URL. */
  upload: (file: File) => Promise<string>
  onSave: (next: PhotoSave) => Promise<void>
  /** Namespaces the radio group and input ids when two of these share a page. */
  idPrefix: string
}) {
  const showToast = useToast()
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tagging = switchUrl !== undefined
  // A draft with no photos yet is fine; going back to none is not.
  const canRemove = urls.length > 1

  async function save(next: PhotoSave, toast: string) {
    setBusy(true)
    setError(null)
    try {
      await onSave(next)
      showToast(toast)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  /** The one path in, shared by the picker and the drop. */
  async function addFiles(picked: File[]) {
    if (busy) return
    // Trimmed to the free slots here rather than left to the api: it counts
    // photo_urls before each upload, and a batch that has not saved yet still
    // reads as the old count — so a drop of six would clear all six of those
    // checks and only fail at the save, after six objects had been written.
    const files = picked.slice(0, MAX_PHOTOS - urls.length)
    if (!files.length) return
    setBusy(true)
    setError(null)

    const added: string[] = []
    try {
      // Sequential: storage is the slow part, and firing five at once buys
      // nothing but a harder failure to explain when the third one dies.
      for (const file of files) added.push(await upload(file))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload that photo.')
    }

    // Whatever reached storage is saved even when a later one failed: those
    // objects exist now, and leaving them out of the array would orphan them
    // in the bucket with nothing pointing at them — the same reason the api
    // counts before it uploads rather than after.
    if (added.length) {
      try {
        await onSave({
          photo_urls: [...urls, ...added],
          ...(tagging ? { switch_photo_url: switchUrl } : {}),
        })
        showToast(added.length === 1 ? 'Photo added' : `${added.length} photos added`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save that. Please try again.')
      }
    }
    setBusy(false)
  }

  function add(e: React.ChangeEvent<HTMLInputElement>) {
    // Read before clearing: setting value empties the FileList too. Cleared at
    // all because picking the same file twice in a row is otherwise silent.
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    void addFiles(files)
  }

  function drop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    // Non-images are not filtered out here: the api's 400 names the formats it
    // takes, which is a better answer than a file vanishing on release.
    void addFiles(Array.from(e.dataTransfer.files))
  }

  function remove(url: string) {
    if (!canRemove) return
    const next = urls.filter((u) => u !== url)
    save(
      {
        photo_urls: next,
        // A removed photo cannot go on being the one that shows the switch.
        ...(tagging ? { switch_photo_url: switchUrl === url ? null : switchUrl } : {}),
      },
      'Photo removed'
    )
  }

  function makeCover(url: string) {
    save(
      { photo_urls: [url, ...urls.filter((u) => u !== url)], ...(tagging ? { switch_photo_url: switchUrl } : {}) },
      'Cover updated'
    )
  }

  const full = urls.length >= MAX_PHOTOS

  return (
    // The whole block is the drop target, not just the Add tile: aiming at a
    // 144px square is a worse gesture than letting go anywhere over the row.
    // dragover has to preventDefault or the browser navigates to the file.
    <div
      onDragOver={(e) => {
        if (full) return
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={drop}
      className={`flex flex-col gap-3 rounded-lg ${dragging ? 'outline outline-2 outline-offset-4 outline-dashed outline-brand-dark' : ''}`}
    >
      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}

      <ul className="flex flex-wrap items-start gap-4">
        {urls.map((url, i) => (
          <li key={url} className="flex w-36 flex-col gap-2">
            <div className="relative h-28 overflow-hidden rounded-lg border-2 border-ink bg-sunken">
              <Image src={url} alt={`Photo ${i + 1}`} fill className="object-cover" />
              {i === 0 ? (
                <span className="absolute inset-x-0 bottom-0 border-t-2 border-ink bg-apricot py-0.5 text-center text-[10px] font-black uppercase tracking-wider text-ink">
                  Cover
                </span>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => makeCover(url)}
                  title="Make this the cover"
                  aria-label={`Make photo ${i + 1} the cover`}
                  className="absolute left-1.5 top-1.5 h-7 w-7 rounded-md border-2 border-ink bg-surface text-sm leading-none disabled:opacity-50"
                >
                  ★
                </button>
              )}
              <button
                type="button"
                disabled={busy || !canRemove}
                onClick={() => remove(url)}
                aria-label={
                  canRemove
                    ? `Remove photo ${i + 1}`
                    : 'Remove photo 1 — add another photo first'
                }
                title={canRemove ? undefined : 'Add another photo before removing this one'}
                className="absolute right-1.5 top-1.5 h-7 w-7 rounded-md border-2 border-ink bg-surface text-sm leading-none disabled:opacity-50"
              >
                ×
              </button>
            </div>

            {tagging && (
              <label className="flex cursor-pointer items-center gap-2 text-xs font-bold">
                <input
                  type="radio"
                  name={`${idPrefix}-switch-shot`}
                  checked={switchUrl === url}
                  disabled={busy}
                  onChange={() => save({ photo_urls: urls, switch_photo_url: url }, 'Switch photo set')}
                />
                Shows the switch
              </label>
            )}
          </li>
        ))}

        {urls.length < MAX_PHOTOS && (
          <li>
            <label
              htmlFor={`${idPrefix}-add-photo`}
              className="flex h-28 w-36 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-[3px] border-dashed border-brand-dark bg-brand-tint text-xs font-black text-brand-deep"
            >
              <span className="text-2xl leading-none">+</span>
              {busy ? 'Working…' : dragging ? 'Drop to add' : 'Add photo'}
              <span className="font-semibold">
                {urls.length}/{MAX_PHOTOS}
              </span>
            </label>
            <input
              id={`${idPrefix}-add-photo`}
              type="file"
              // Mirrors the api's PHOTO_MIME and 054's bucket allowlist. AVIF
              // belongs here: the library's own photos are avif files.
              accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif"
              multiple
              className="sr-only"
              disabled={busy}
              onChange={add}
            />
          </li>
        )}
      </ul>

      <p className="text-xs leading-relaxed text-muted">
        Up to {MAX_PHOTOS} photos — drop them here or use the box. The first one is the cover — it
        is what shows on cards and in search. ★ moves a photo to the front.
        {urls.length === 1 && ' Add another photo before you can remove this one.'}
      </p>
    </div>
  )
}
