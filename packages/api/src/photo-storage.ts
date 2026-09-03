/**
 * Deleting the storage object behind a photo the owner removed.
 *
 * WHY here rather than a DELETE /upload/photo endpoint: the array is edited by
 * a PATCH on the toy or the tutorial, so a separate delete call would be a
 * second round trip that can half-fail — the row saved, the object left behind,
 * or worse the object gone and the row unchanged. Diffing inside the same save
 * catches every removal path, including "replaced all five", for free.
 *
 * Best-effort by design. If the bucket refuses the delete the save still
 * succeeds: photo_urls is what the app renders, and failing a person's save
 * because a file lingered would trade a real problem for a worse one. The
 * failure is logged so an orphan is findable rather than silent.
 */
import { createAdminClient } from './supabase/client.js'

/**
 * `<id>/<uuid>.jpg` out of a public storage URL, or null if the URL does not
 * belong to this bucket. Null rather than a guess: these paths are fed to a
 * delete, so a URL we cannot confidently parse must be skipped, never
 * approximated into a path that might name someone else's object.
 */
function objectPath(url: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`
  const at = url.indexOf(marker)
  if (at === -1) return null
  return decodeURIComponent(url.slice(at + marker.length))
}

/** Removes the objects for photos present in `before` but gone from `after`. */
export async function removeDroppedPhotos(
  bucket: string,
  before: string[],
  after: string[]
): Promise<void> {
  const dropped = before.filter((url) => !after.includes(url))
  if (!dropped.length) return

  const paths = dropped
    .map((url) => objectPath(url, bucket))
    .filter((path): path is string => path !== null)
  if (!paths.length) return

  // Admin client: the buckets carry no DELETE policy, only the owner-scoped
  // INSERT one from 032 — the same reason the old /photo route reached for it.
  const { error } = await createAdminClient().storage.from(bucket).remove(paths)
  if (error) console.error('[photo-storage] could not remove', paths, error.message)
}
