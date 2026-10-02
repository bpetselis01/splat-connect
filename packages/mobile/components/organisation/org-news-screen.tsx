// packages/mobile/components/organisation/org-news-screen.tsx
/**
 * Where a "followed organisation published" notification lands (077).
 *
 * Mobile has no event or story screen, and the notification names only the
 * event or story. This reads which organisation it belongs to and replaces
 * itself with that organisation's profile, whose Recent activity lists it — a
 * real destination rather than a row that opens nothing.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { apiClient } from '../../lib/api-client'
import { Screen } from '../ui/Screen'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'

export function OrgNewsScreen({ kind, id }: { kind: 'event' | 'story'; id: string }) {
  const router = useRouter()
  const [gone, setGone] = useState(false)

  useEffect(() => {
    apiClient
      .get<{ org_id: string | null }>(`/api/public/${kind === 'event' ? 'events' : 'stories'}/${id}`)
      .then((row) => {
        if (row.org_id) router.replace({ pathname: '/toy-library/organisation/[id]', params: { id: row.org_id } })
        else setGone(true)
      })
      // Unpublished since, or deleted: say so rather than spin.
      .catch(() => setGone(true))
  }, [kind, id, router])

  return (
    <Screen>
      {gone ? (
        <EmptyState icon="newspaper-outline" title="That is no longer published." hint="The organisation may have taken it down." />
      ) : (
        <SkeletonRow />
      )}
    </Screen>
  )
}
