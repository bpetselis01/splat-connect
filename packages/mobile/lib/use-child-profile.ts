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

  useEffect(() => {
    let ignore = false
    apiClient
      .get<ChildProfile | null>('/api/child-profile')
      .then((p) => { if (!ignore && !dirty.current) setProfile(p) })
      .catch(() => { if (!ignore && !dirty.current) setProfile(null) })
      .finally(() => { if (!ignore) setLoading(false) })
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
      apiClient
        .put<ChildProfile>('/api/child-profile', body)
        .then(() => setSaveState('saved'))
        // Back to idle rather than a false "saved" — never claim a write landed
        // when it didn't. The value stays on screen (optimistic) to retype/retry.
        .catch(() => setSaveState('idle'))
    }, 250)
  }

  return { profile, loading, save, saveState }
}
