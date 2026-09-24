// packages/mobile/components/saved/saved-screen.tsx
// The Saved hub: one count tile per type that can be saved. Mobile's
// half of web's app/dashboard/saved/page.tsx. There is no "Recently saved"
// strip: GET /api/saves/:slug already returns each list in save order, newest
// first, so the lists themselves are the recency view.
//
// Title comes from the native header (app/(my)/_layout.tsx).
import { useCallback, useEffect, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { SavedIds, SaveSlug } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { SkeletonRow } from '../ui/Skeleton'
import { ListIntro, ListRow, RowThumb } from '../list/list-kit'

const TILES: { slug: SaveSlug; label: string; noun: [string, string]; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { slug: 'tutorials', label: 'Guides', noun: ['guide', 'guides'], icon: 'book-outline' },
  { slug: 'toys', label: 'Toys', noun: ['toy', 'toys'], icon: 'cube-outline' },
  { slug: 'challenges', label: 'Challenges', noun: ['challenge', 'challenges'], icon: 'bulb-outline' },
  { slug: 'organisations', label: 'Organisations', noun: ['organisation', 'organisations'], icon: 'business-outline' },
]

const NONE: SavedIds = { tutorials: [], toys: [], challenges: [], organisations: [] }

export function SavedScreen() {
  const router = useRouter()
  const [ids, setIds] = useState<SavedIds>(NONE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError(false)
    apiClient
      .get<SavedIds>('/api/saves/ids')
      .then((data) => {
        if (!ignore) setIds(data)
      })
      .catch((err) => {
        console.error('[SavedScreen] saves fetch failed:', err)
        if (!ignore) setError(true)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [reloadKey])

  // Saving and unsaving both happen on other screens, so these counts are
  // stale the moment you come back without this.
  useFocusEffect(
    useCallback(() => {
      setReloadKey((k) => k + 1)
    }, [])
  )

  return (
    <Screen>
      {loading ? (
        <View>
          <SkeletonRow />
          <SkeletonRow />
        </View>
      ) : error ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load what you've saved."
          hint="Check your connection and try again."
        >
          <Button
            label="Try again"
            variant="secondary"
            onPress={() => setReloadKey((k) => k + 1)}
            style={styles.retry}
          />
        </EmptyState>
      ) : (
        <View>
          <ListIntro lead="Everything you kept to come back to, grouped by the kind of thing it is." />
          {TILES.map(({ slug, label, noun, icon }) => {
            const count = ids[slug].length
            return (
              <View key={slug} style={styles.rowWrap}>
                <ListRow
                  onPress={() => router.push(`/saved/${slug}`)}
                  accessibilityLabel={label}
                  accessibilityHint={count ? `${count} saved. Opens the list.` : 'Nothing saved yet. Opens the list.'}
                  thumb={<RowThumb glyph={icon} />}
                  title={label}
                  meta={count ? `${count} ${count === 1 ? noun[0] : noun[1]} you kept` : 'Nothing saved yet'}
                />
              </View>
            )
          })}
        </View>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  retry: { marginTop: theme.spacing(5), alignSelf: 'center', paddingHorizontal: theme.spacing(8) },
  rowWrap: { marginBottom: theme.spacing(3) },
})
