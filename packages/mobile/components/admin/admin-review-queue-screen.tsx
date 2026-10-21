// packages/mobile/components/admin/admin-review-queue-screen.tsx
// The admin's pending guides, oldest first: GET /api/admin/tutorials?status=pending.
// Mobile's half of web's app/admin/review/page.tsx. Decision 23: the admin sees
// every pending guide, including ones an organisation has accepted, and the row
// says so. The API's is_admin guard is the only check; a 403 shows "Admins only".
import { logFailure } from '../../lib/log'
import { useCallback, useState } from 'react'
import { View, ScrollView, StyleSheet } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import type { Tutorial, TutorialOrg, Organization } from '@splat-connect/types'
import { isApiError } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { SkeletonRow } from '../ui/Skeleton'
import { ListIntro, ListRow, Pill, RowThumb } from '../list/list-kit'

type Row = Tutorial & { tutorial_orgs?: (Pick<TutorialOrg, 'status'> & { organizations?: Pick<Organization, 'id' | 'name'> | null })[] }

const DIFFICULTY: Record<string, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }
const day = (iso: string) => new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })

export function AdminReviewQueueScreen() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  // Deciding happens on the detail screen; the list is stale the moment you return.
  useFocusEffect(
    useCallback(() => {
      let ignore = false
      setError(false)
      apiClient
        .get<Row[]>('/api/admin/tutorials?status=pending')
        .then((data) => {
          if (!ignore) setRows(data)
        })
        .catch((err) => {
          logFailure('[AdminReviewQueueScreen] fetch failed:', err)
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
    }, [reloadKey])
  )

  if (forbidden) {
    return (
      <Screen>
        <EmptyState icon="lock-closed-outline" title="Admins only" hint="This screen belongs to admins." />
      </Screen>
    )
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ListIntro lead="Guides waiting for a decision. Oldest first." />
        {loading ? (
          <View>
            <SkeletonRow />
            <SkeletonRow />
          </View>
        ) : error ? (
          <EmptyState icon="cloud-offline-outline" title="Couldn't load the queue." hint="Check your connection and try again.">
            <Button
              label="Try again"
              variant="secondary"
              onPress={() => {
                setLoading(true)
                setReloadKey((k) => k + 1)
              }}
              style={styles.retry}
            />
          </EmptyState>
        ) : rows.length === 0 ? (
          <EmptyState icon="file-tray-outline" title="Nothing waiting." hint="Submitted guides show up here." />
        ) : (
          rows.map((t) => {
            const backer = t.tutorial_orgs?.find((o) => o.status === 'accepted')?.organizations?.name
            const meta = [backer ? `${backer} accepted` : null, DIFFICULTY[t.difficulty], day(t.created_at)].filter(Boolean).join(' · ')
            return (
              <View key={t.id} style={styles.rowPress}>
                <ListRow
                  title={t.title}
                  meta={meta}
                  thumb={<RowThumb photo={t.toy_photo_url} glyph="book-outline" />}
                  pill={<Pill label="Ready to review" bg={theme.colors.accentLight} icon="eye-outline" />}
                  onPress={() => router.push(`/admin/review/${t.id}`)}
                  accessibilityHint="Opens the review."
                />
              </View>
            )
          })
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing(6) },
  retry: { marginTop: theme.spacing(5), alignSelf: 'center', paddingHorizontal: theme.spacing(8) },
  rowPress: { marginBottom: theme.spacing(3) },
})
