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
  // Requests for one id go out one after another: a quick second tap used to
  // send its DELETE before the first tap's POST had landed, which the server
  // answered as a no-op, leaving the row saved after the screen said otherwise.
  const queue = useRef(new Map<string, Promise<unknown>>())
  // Ids tapped before the saved list arrived. A slow list must not undo them:
  // the tap is newer than whatever the list says.
  const touched = useRef(new Map<SaveSlug, Set<string>>())

  useEffect(() => {
    let ignore = false
    apiClient.get<SavedIds>('/api/saves/ids').then((ids) => {
      if (ignore) return
      const next: SavedIds = { ...NONE, ...ids }
      for (const [slug, tapped] of touched.current) {
        const kept = next[slug].filter((x) => !tapped.has(x))
        next[slug] = [...kept, ...savedRef.current[slug].filter((x) => tapped.has(x))]
      }
      confirmed.current = next
      commit(next)
    }).catch(() => {})
    return () => { ignore = true }
  }, [commit])

  const isSaved = useCallback((slug: SaveSlug, id: string) => savedIds[slug].includes(id), [savedIds])

  const toggle = useCallback(async (slug: SaveSlug, id: string) => {
    const was = savedRef.current[slug].includes(id)
    touched.current.set(slug, (touched.current.get(slug) ?? new Set()).add(id))
    const withoutId = (ids: string[]) => ids.filter((x) => x !== id)
    commit({ ...savedRef.current, [slug]: was ? withoutId(savedRef.current[slug]) : [...savedRef.current[slug], id] })
    const key = `${slug}:${id}`
    inFlight.current.set(key, (inFlight.current.get(key) ?? 0) + 1)
    const send = (queue.current.get(key) ?? Promise.resolve()).then(() =>
      was ? apiClient.delete(`/api/saves/${slug}/${id}`) : apiClient.post('/api/saves', { entity_type: SAVE_SLUGS[slug], entity_id: id }),
    )
    queue.current.set(key, send.catch(() => {}))
    try {
      await send
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
