import { useCallback, useEffect, useRef, useState } from 'react'
import { SAVE_SLUGS, type SavedIds, type SaveSlug } from '@splat-connect/types'
import { apiClient } from './api-client'

const NONE: SavedIds = { tutorials: [], toys: [], challenges: [] }

export type Saves = {
  savedIds: SavedIds
  isSaved: (slug: SaveSlug, id: string) => boolean
  toggle: (slug: SaveSlug, id: string) => Promise<void>
}

export function useSaves(): Saves {
  const [savedIds, setSavedIds] = useState<SavedIds>(NONE)
  // The ref is the synchronous truth; state mirrors it for rendering. toggle
  // reads and writes the ref in the same tick, so two taps before a re-render
  // still see each other.
  const savedRef = useRef<SavedIds>(NONE)
  const commit = useCallback((next: SavedIds) => { savedRef.current = next; setSavedIds(next) }, [])

  useEffect(() => {
    let ignore = false
    apiClient.get<SavedIds>('/api/saves/ids').then((ids) => { if (!ignore) commit(ids) }).catch(() => {})
    return () => { ignore = true }
  }, [commit])

  const isSaved = useCallback((slug: SaveSlug, id: string) => savedIds[slug].includes(id), [savedIds])

  const toggle = useCallback(async (slug: SaveSlug, id: string) => {
    const was = savedRef.current[slug].includes(id)
    const withoutId = (ids: string[]) => ids.filter((x) => x !== id)
    commit({ ...savedRef.current, [slug]: was ? withoutId(savedRef.current[slug]) : [...savedRef.current[slug], id] })
    try {
      if (was) await apiClient.delete(`/api/saves/${slug}/${id}`)
      else await apiClient.post('/api/saves', { entity_type: SAVE_SLUGS[slug], entity_id: id })
    } catch {
      // Revert only this id, against whatever the ref holds NOW — other ids may
      // have moved while the request was in flight.
      const ids = savedRef.current[slug]
      commit({ ...savedRef.current, [slug]: was ? (ids.includes(id) ? ids : [...ids, id]) : withoutId(ids) })
    }
  }, [commit])

  return { savedIds, isSaved, toggle }
}
