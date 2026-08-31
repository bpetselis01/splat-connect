import { useCallback, useEffect, useState } from 'react'
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

  useEffect(() => {
    let ignore = false
    apiClient.get<SavedIds>('/api/saves/ids').then((ids) => { if (!ignore) setSavedIds(ids) }).catch(() => {})
    return () => { ignore = true }
  }, [])

  const isSaved = useCallback((slug: SaveSlug, id: string) => savedIds[slug].includes(id), [savedIds])

  const toggle = useCallback(async (slug: SaveSlug, id: string) => {
    const was = savedIds[slug].includes(id)
    const flip = (ids: SavedIds, on: boolean): SavedIds => ({
      ...ids, [slug]: on ? [...ids[slug], id] : ids[slug].filter((x) => x !== id),
    })
    setSavedIds((ids) => flip(ids, !was))
    try {
      if (was) await apiClient.delete(`/api/saves/${slug}/${id}`)
      else await apiClient.post('/api/saves', { entity_type: SAVE_SLUGS[slug], entity_id: id })
    } catch {
      setSavedIds((ids) => flip(ids, was))
    }
  }, [savedIds])

  return { savedIds, isSaved, toggle }
}
