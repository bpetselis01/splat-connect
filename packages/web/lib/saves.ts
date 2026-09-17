/**
 * Which things this visitor has already saved, for a page that renders cards.
 *
 * Returns null when signed out, and that null is the signal the cards pass on
 * as `signedIn`: a signed-out browse page makes no extra request at all, while
 * the button still renders so the feature is discoverable to the audience most
 * likely to want it.
 *
 * Wrapped in cache() for the reason getCapabilities is — a layout and its page
 * share one round of fetches rather than two.
 *
 * Related files:
 * - lib/capabilities.ts: the signed-in check this piggybacks on
 * - packages/api/src/routes/saves.ts: GET /api/saves/ids
 */
import { cache } from 'react'
import { SAVE_SLUGS, type SaveSlug, type SavedIds } from '@splat-connect/types'
import { apiClient } from '@/lib/api-client'
import { getCapabilities } from '@/lib/capabilities'

// Built from SAVE_SLUGS rather than written out, so switching a type on stays
// the one-line change that constant promises.
const NOTHING: SavedIds = Object.fromEntries(
  (Object.keys(SAVE_SLUGS) as SaveSlug[]).map((slug) => [slug, [] as string[]])
) as SavedIds

export const getSavedIds = cache(async (): Promise<SavedIds | null> => {
  const caps = await getCapabilities()
  if (!caps) return null

  // Degrades to "nothing saved" rather than blanking the page: one flaky fetch
  // should cost an unfilled bookmark, not a browse grid.
  return apiClient.get<SavedIds>('/api/saves/ids').catch(() => NOTHING)
})
