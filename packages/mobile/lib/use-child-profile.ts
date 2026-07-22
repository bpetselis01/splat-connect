import { useEffect, useRef, useState } from 'react'
import type { ChildProfile } from '@splat-connect/types'
import { apiClient } from './api-client'

export function useChildProfile() {
  const [profile, setProfile] = useState<ChildProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const pending = useRef<Partial<ChildProfile>>({})
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let ignore = false
    apiClient
      .get<ChildProfile | null>('/api/child-profile')
      .then((p) => { if (!ignore) setProfile(p) })
      .catch(() => { if (!ignore) setProfile(null) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [])

  function save(patch: Partial<ChildProfile>) {
    setProfile((prev) => ({ ...(prev ?? {}), ...patch } as ChildProfile)) // optimistic
    pending.current = { ...pending.current, ...patch }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const body = pending.current
      pending.current = {}
      apiClient.put<ChildProfile>('/api/child-profile', body).catch(() => {})
    }, 250)
  }

  return { profile, loading, save }
}
