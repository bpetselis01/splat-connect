// packages/mobile/components/admin/spot-check-screen.tsx
// A random sample of guides an organisation leader approved: GET /api/admin/spot-check.
// Mobile's half of web's app/admin/spot-check/page.tsx. Each row opens the admin
// review screen, where Unpublish (with its required note) lives.
import { View, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { shortDate } from '@splat-connect/types'
import type { Tutorial, TutorialOrg, Organization } from '@splat-connect/types'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { EmptyState } from '../ui/EmptyState'
import { ListIntro, ListRow, RowThumb } from '../list/list-kit'
import { AdminsOnly, LoadFailed, LoadingRows, useAdminLoad } from './use-admin-load'

type Sampled = Tutorial & { tutorial_orgs?: (Pick<TutorialOrg, 'status'> & { organizations?: Pick<Organization, 'id' | 'name'> | null })[] }

export function SpotCheckScreen() {
  const router = useRouter()
  const { data, loading, error, forbidden, retry } = useAdminLoad<Sampled[]>('/api/admin/spot-check')

  if (forbidden) {
    return (
      <Screen>
        <AdminsOnly />
      </Screen>
    )
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ListIntro lead="Guides an organisation leader approved. Audit a sample, and unpublish anything that was not ready." />
        {loading ? (
          <LoadingRows />
        ) : error ? (
          <LoadFailed onRetry={retry} />
        ) : !data || data.length === 0 ? (
          <EmptyState icon="search-outline" title="Nothing to check yet." hint="Guides appear here once an organisation leader has approved one." />
        ) : (
          data.map((t) => {
            const org = t.tutorial_orgs?.find((o) => o.status === 'accepted')?.organizations?.name
            const meta = ['Approved', org ? `for ${org}` : null, t.reviewed_at ? `· ${shortDate(t.reviewed_at)}` : null].filter(Boolean).join(' ')
            return (
              <View key={t.id} style={styles.item}>
                <ListRow
                  title={t.title}
                  meta={meta}
                  thumb={<RowThumb photo={t.toy_photo_url} glyph="book-outline" />}
                  onPress={() => router.push(`/admin/review/${t.id}`)}
                  accessibilityHint="Opens the review, where you can unpublish."
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
  item: { marginBottom: theme.spacing(3) },
})
