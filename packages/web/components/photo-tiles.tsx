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
 * Order is upload order and the first photo is the cover; ★ promotes one to
 * the front. Deliberately not drag-to-reorder: with five photos the only
 * question anyone asks is which one leads, and a drag affordance would have
 * cost a gesture dependency on mobile to answer it.
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
  const [error, setError] = useState<string | null>(null)
  const tagging = switchUrl !== undefined

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

  async function add(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Clear it straight away, or picking the same file twice in a row is silent.
    e.target.value = ''
    if (!file || busy) return
    setBusy(true)
    setError(null)
    try {
      const url = await upload(file)
      await onSave({ photo_urls: [...urls, url], ...(tagging ? { switch_photo_url: switchUrl } : {}) })
      showToast('Photo added')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload that photo.')
    } finally {
      setBusy(false)
    }
  }

  function remove(url: string) {
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

  return (
    <div className="flex flex-col gap-3">
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
                disabled={busy}
                onClick={() => remove(url)}
                aria-label={`Remove photo ${i + 1}`}
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
              {busy ? 'Working…' : 'Add photo'}
              <span className="font-semibold">
                {urls.length}/{MAX_PHOTOS}
              </span>
            </label>
            <input
              id={`${idPrefix}-add-photo`}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="sr-only"
              disabled={busy}
              onChange={add}
            />
          </li>
        )}
      </ul>

      <p className="text-xs leading-relaxed text-muted">
        Up to {MAX_PHOTOS} photos. The first one is the cover — it is what shows on cards and in
        search. ★ moves a photo to the front.
      </p>
    </div>
  )
}
