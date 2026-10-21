// packages/mobile/components/admin/use-admin-load.tsx
// One admin read, shared by the queue screens. The API's is_admin guard is the
// only check: a 403 becomes the "Admins only" state, never a client-side seat test.
import { logFailure } from '../../lib/log'
import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { apiMessage, isApiError } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { EmptyState } from '../ui/EmptyState'
import { Button } from '../ui/Button'
import { SkeletonRow } from '../ui/Skeleton'
import { View } from 'react-native'

/** The sentence for a failed admin write: a 403 is the guard, anything else is the server's own words. */
export const adminError = (err: unknown) =>
  isApiError(err) && err.status === 403 ? 'Admins only.' : apiMessage(err, 'Something went wrong. Please try again.')

export function useAdminLoad<T>(path: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  // Deciding happens on a detail screen, so the list is stale the moment you return.
  useFocusEffect(
    useCallback(() => {
      let ignore = false
      setError(false)
      apiClient
        .get<T>(path)
        .then((d) => {
          if (!ignore) setData(d)
        })
        .catch((err) => {
          logFailure(`[useAdminLoad] ${path} failed:`, err)
          if (ignore) return
          if (isApiError(err) && err.status === 403) setForbidden(true)
          else setError(true)
        })
        .finally(() => {
          if (!ignore) setLoading(false)
        })
      return () => {
        ignore = true
      }
    }, [path, reloadKey])
  )

  const retry = () => {
    setLoading(true)
    setReloadKey((k) => k + 1)
  }
  return { data, setData, loading, error, forbidden, retry }
}

export function AdminsOnly() {
  return <EmptyState icon="lock-closed-outline" title="Admins only" hint="This screen belongs to admins." />
}

/** The loading and failed halves of a queue, so each screen only writes its loaded half. */
export function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState icon="cloud-offline-outline" title="Couldn't load the queue." hint="Check your connection and try again.">
      <Button label="Try again" variant="secondary" onPress={onRetry} style={{ marginTop: theme.spacing(5), alignSelf: 'center', paddingHorizontal: theme.spacing(8) }} />
    </EmptyState>
  )
}

export function LoadingRows() {
  return (
    <View>
      <SkeletonRow />
      <SkeletonRow />
    </View>
  )
}
