// packages/mobile/components/organisation/org-news-screen.tsx
/**
 * Where an older "followed organisation published" link lands (077).
 *
 * An event has its own screen now, so an event link is handed straight to it.
 * A story still has none and the link names only the story: this reads which
 * organisation it belongs to and replaces itself with that organisation's
 * profile, whose Recent activity lists it.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { isNetworkError } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { logFailure } from '../../lib/log'
import { Screen } from '../ui/Screen'
import { SkeletonRow } from '../ui/Skeleton'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'

export function OrgNewsScreen({ kind, id }: { kind: 'event' | 'story'; id: string }) {
  const router = useRouter()
  const [gone, setGone] = useState(false)
  const [failed, setFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (kind === 'event') return router.replace(`/events/${id}` as never)
    setFailed(false)
    apiClient
      .get<{ org_id: string | null }>(`/api/public/stories/${id}`)
      .then((row) => {
        if (row.org_id) router.replace({ pathname: '/toy-library/organisation/[id]', params: { id: row.org_id } })
        else setGone(true)
      })
      .catch((err) => {
        // Unpublished since, or deleted: say so rather than spin. Only being offline can be retried.
        if (!isNetworkError(err)) return setGone(true)
        logFailure('[OrgNewsScreen] load failed:', err)
        setFailed(true)
      })
  }, [kind, id, router, reloadKey])

  return (
    <Screen>
      {gone ? (
        <EmptyState icon="newspaper-outline" title="That is no longer published." hint="The organisation may have taken it down." />
      ) : failed ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="You seem to be offline."
          hint="Check your connection and try again."
        >
          <Button label="Try again" variant="secondary" onPress={() => setReloadKey((k) => k + 1)} />
        </EmptyState>
      ) : (
        <SkeletonRow />
      )}
    </Screen>
  )
}
