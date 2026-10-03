import { useCallback, useEffect, useRef, useState } from 'react'
import { SAVE_SLUGS, type SavedIds, type SaveSlug } from '@splat-connect/types'
import { apiClient } from './api-client'

const NONE: SavedIds = { tutorials: [], toys: [], challenges: [], organisations: [], parts: [] }

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
  // What the server last confirmed, and how many requests are still out per id:
  // when the last one for an id fails, the screen goes back to the confirmed
  // state, not to a guess made from one request's `was`.
  const confirmed = useRef<SavedIds>(NONE)
  const inFlight = useRef(new Map<string, number>())

  useEffect(() => {
    let ignore = false
    apiClient.get<SavedIds>('/api/saves/ids').then((ids) => { if (!ignore) { confirmed.current = { ...NONE, ...ids }; commit(confirmed.current) } }).catch(() => {})
    return () => { ignore = true }
  }, [commit])

  const isSaved = useCallback((slug: SaveSlug, id: string) => savedIds[slug].includes(id), [savedIds])

  const toggle = useCallback(async (slug: SaveSlug, id: string) => {
    const was = savedRef.current[slug].includes(id)
    const withoutId = (ids: string[]) => ids.filter((x) => x !== id)
    commit({ ...savedRef.current, [slug]: was ? withoutId(savedRef.current[slug]) : [...savedRef.current[slug], id] })
    const key = `${slug}:${id}`
    inFlight.current.set(key, (inFlight.current.get(key) ?? 0) + 1)
    try {
      if (was) await apiClient.delete(`/api/saves/${slug}/${id}`)
      else await apiClient.post('/api/saves', { entity_type: SAVE_SLUGS[slug], entity_id: id })
      const c = confirmed.current[slug]
      confirmed.current = { ...confirmed.current, [slug]: was ? c.filter((x) => x !== id) : c.includes(id) ? c : [...c, id] }
    } catch {
      // Once the last request for this id has failed, show what the server
      // holds. Other ids may have moved meanwhile, so only this one is touched.
      if ((inFlight.current.get(key) ?? 1) <= 1) {
        const ids = savedRef.current[slug]
        const hold = confirmed.current[slug].includes(id)
        commit({ ...savedRef.current, [slug]: hold ? (ids.includes(id) ? ids : [...ids, id]) : withoutId(ids) })
      }
    } finally {
      inFlight.current.set(key, (inFlight.current.get(key) ?? 1) - 1)
    }
  }, [commit])

  return { savedIds, isSaved, toggle }
}
