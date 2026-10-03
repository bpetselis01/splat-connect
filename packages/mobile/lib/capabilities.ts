// Mirrors packages/web/lib/capabilities.ts: same four endpoints, same
// degradation. Web caches per request; mobile refetches on demand (refresh)
// and whenever the session changes.
import { useCallback, useEffect, useState } from 'react'
import type { Capabilities, Organization, Profile, UnreadCounts } from '@splat-connect/types'
import { apiClient } from './api-client'
import { useAuth } from './auth-context'

const NO_UNREAD: UnreadCounts = { tutorials: 0, exchanges: 0, challenges: 0, organisations: 0, total: 0 }

async function fetchCapabilities(): Promise<Capabilities | null> {
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

// Every screen that calls useCapabilities holds its own copy (the tab bar, Home's
// Today card, Me), fetched once on mount. A count that changes afterwards, such
// as a notification read in the Inbox, reaches them through this.
// ponytail: each mounted copy refetches its own four calls; share one store if
// the number of mounted copies ever matters.
const stale = new Set<() => void>()
export const invalidateCapabilities = () => stale.forEach((refresh) => refresh())

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
  useEffect(() => {
    stale.add(refresh)
    return () => { stale.delete(refresh) }
  }, [refresh])

  return { caps, loading, refresh }
}
