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
import type { SavedIds } from '@splat-connect/types'
import { apiClient } from '@/lib/api-client'
import { getCapabilities } from '@/lib/capabilities'

const NOTHING: SavedIds = { tutorials: [], toys: [], challenges: [] }

export const getSavedIds = cache(async (): Promise<SavedIds | null> => {
  const caps = await getCapabilities()
  if (!caps) return null

  // Degrades to "nothing saved" rather than blanking the page: one flaky fetch
  // should cost an unfilled bookmark, not a browse grid.
  return apiClient.get<SavedIds>('/api/saves/ids').catch(() => NOTHING)
})
