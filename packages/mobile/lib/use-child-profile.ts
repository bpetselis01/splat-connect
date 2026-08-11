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
  // the collection oldest-first, so that is the first entry. `id.current === null`
  // is ambiguous — "no child exists yet" and "we don't currently know" look the
  // same — so the write chain below re-reads the collection before trusting a
  // null id rather than caching a verdict that can go stale.
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
        const first = list?.[0] ?? null
        // Assigned unconditionally, even after unmount (ignore) or once the
        // user has started editing (dirty): refs are safe to write post-unmount
        // and have no render effect, and a write already queued behind this
        // promise needs the real id (or to know the account truly has none) to
        // avoid POSTing a duplicate. Only the visible `profile` state is guarded.
        id.current = first?.id ?? null
        if (!ignore && !dirty.current) setProfile(first)
      })
      .catch(() => {
        // id.current stays null here — a failed load means we don't know
        // whether this account already has a child. The write chain re-reads
        // before POSTing, so this isn't a lockout: the next save just retries
        // the read instead of trusting a stale "no child" verdict.
        if (!ignore && !dirty.current) setProfile(null)
      })
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
      writes.current = writes.current
        .then(async () => {
          setSaveState('saving')
          // We only know it is safe to POST after seeing the collection. The
          // endpoint this replaced was an idempotent upsert; POST is not, and
          // the server does not dedupe, so guessing here creates a second child.
          // Re-reading also self-heals the two ways id goes unknown: a mount
          // load that failed, and a POST whose response was lost after the row
          // landed.
          if (!id.current) {
            const list = await apiClient.get<ChildProfile[]>('/api/child-profiles')
            id.current = list?.[0]?.id ?? null
          }
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
        // Swallowing here also keeps the chain resolved so later writes still
        // run, and — since nothing was cached as a verdict — the next write
        // retries from scratch instead of repeating whatever just failed.
        .catch(() => setSaveState('idle'))
    }, 250)
  }

  return { profile, loading, save, saveState }
}
