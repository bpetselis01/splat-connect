// Mirrors packages/web/lib/capabilities.ts: same four endpoints, same
// degradation. Web caches per request; mobile refetches on demand (refresh)
// and whenever the session changes.
import { useCallback, useEffect, useState } from 'react'
import type { Capabilities, Organization, Profile, UnreadCounts } from '@splat-connect/types'
import { apiClient } from './api-client'
import { useAuth } from './auth-context'

const NO_UNREAD: UnreadCounts = { tutorials: 0, exchanges: 0, challenges: 0, total: 0 }

export async function fetchCapabilities(): Promise<Capabilities | null> {
  let profile: Profile
  try {
    profile = await apiClient.get<Profile>('/api/contributors/me')
  } catch {
    return null
  }
  const [ledOrgs, unread, exchangeActions] = await Promise.all([
    apiClient.get<Organization[]>('/api/organizations/mine').catch(() => [] as Organization[]),
    apiClient.get<UnreadCounts>('/api/notifications/me/unread-counts').catch(() => NO_UNREAD),
    apiClient.get<{ count: number }>('/api/toy-transactions/action-count').then((r) => r.count).catch(() => 0),
  ])
  return { profile, isAdmin: profile.role === 'admin', ledOrgs, unread, exchangeActions }
}

export function useCapabilities() {
  const { session } = useAuth()
  const [caps, setCaps] = useState<Capabilities | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!session) { setCaps(null); setLoading(false); return }
    setCaps(await fetchCapabilities())
    setLoading(false)
  }, [session])

  useEffect(() => { refresh() }, [refresh])

  return { caps, loading, refresh }
}
