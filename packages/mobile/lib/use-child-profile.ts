import { useEffect, useRef, useState } from 'react'
import type { ChildProfile } from '@splat-connect/types'
import { apiClient } from './api-client'

export type SaveState = 'idle' | 'saving' | 'saved'

export function useChildProfile() {
  const [profile, setProfile] = useState<ChildProfile | null>(null)
  const [loading, setLoading] = useState(true)
  // Surfaced so the screen can confirm the silent autosave actually persisted —
  // on a field holding a child's data, "did that save?" should not be a guess.
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const pending = useRef<Partial<ChildProfile>>({})
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Once the user edits, the in-flight mount load must not clobber their work
  // (a slow GET resolving after the first keystroke would otherwise win).
  const dirty = useRef(false)
  // Which child this screen is editing. Mobile shows one child; the API orders
  // the collection oldest-first, so that is the first entry.
  const id = useRef<string | null>(null)
  // Every write queues here. The old endpoint was an upsert, so repeats were
  // harmless; POST is not idempotent, so two saves racing before the first
  // response lands would create two children. Serialising them means the second
  // always sees the id the first established. Initialised to the mount load for
  // the same reason: a save fired mid-load must not POST alongside it.
  const writes = useRef<Promise<unknown>>(Promise.resolve())

  useEffect(() => {
    let ignore = false
    const load = apiClient
      .get<ChildProfile[]>('/api/child-profiles')
      .then((list) => {
        if (ignore) return
        const first = list?.[0] ?? null
        // Set even when the user has already started editing: without the id a
        // queued save would POST a duplicate instead of patching this child.
        id.current = first?.id ?? null
        if (!dirty.current) setProfile(first)
      })
      .catch(() => { if (!ignore && !dirty.current) setProfile(null) })
      .finally(() => { if (!ignore) setLoading(false) })
    writes.current = load
    return () => { ignore = true }
  }, [])

  function save(patch: Partial<ChildProfile>) {
    dirty.current = true
    setProfile((prev) => ({ ...(prev ?? {}), ...patch } as ChildProfile)) // optimistic
    pending.current = { ...pending.current, ...patch }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const body = pending.current
      pending.current = {}
      setSaveState('saving')
      writes.current = writes.current
        .then(async () => {
          if (id.current) {
            await apiClient.patch<ChildProfile>(`/api/child-profiles/${id.current}`, body)
          } else {
            const created = await apiClient.post<ChildProfile>('/api/child-profiles', body)
            id.current = created.id
          }
          setSaveState('saved')
        })
        // Back to idle rather than a false "saved" — never claim a write landed
        // when it didn't. The value stays on screen (optimistic) to retype/retry.
        // Swallowing here also keeps the chain resolved so later writes still run.
        .catch(() => setSaveState('idle'))
    }, 250)
  }

  return { profile, loading, save, saveState }
}
