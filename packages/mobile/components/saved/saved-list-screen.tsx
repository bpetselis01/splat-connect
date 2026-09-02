// packages/mobile/components/saved/saved-list-screen.tsx
// One saved-type list. GET /api/saves/:slug returns each entity in the same
// shape its public list serves (the route copies those selects on purpose), so
// this renders compact rows rather than re-implementing the three full cards —
// a saved list is a shortcut shelf, not a second browse surface.
//
// The native header carries the type's name (app/(my)/_layout.tsx).
import { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { SaveSlug } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { useSaves } from '../../lib/saves'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { SkeletonRow } from '../ui/Skeleton'
import { SaveButton } from '../ui/SaveButton'
import { AnimatedPressable } from '../ui/AnimatedPressable'

/** The wire shape is per-slug; these are the fields the rows read. */
type SavedEntity = {
  id: string
  title?: string
  name?: string
  summary?: string | null
  description?: string | null
  condition?: number
}

const KIND: Record<
  SaveSlug,
  {
    noun: string
    icon: React.ComponentProps<typeof Ionicons>['name']
    route: (id: string) => string
    browseLabel: string
    browse: string
  }
> = {
  tutorials: {
    noun: 'guides',
    icon: 'book-outline',
    route: (id) => `/guides/${id}`,
    browseLabel: 'Browse the guides',
    browse: '/guides',
  },
  toys: {
    noun: 'toys',
    icon: 'cube-outline',
    route: (id) => `/toy-library/${id}`,
    browseLabel: 'Browse the toy library',
    browse: '/toy-library',
  },
  challenges: {
    noun: 'challenges',
    icon: 'bulb-outline',
    route: (id) => `/explore/challenges/${id}`,
    browseLabel: 'Browse design challenges',
    browse: '/explore/challenges',
  },
}

export function SavedListScreen({ slug }: { slug: SaveSlug }) {
  const router = useRouter()
  const saves = useSaves()
  const kind = KIND[slug]
  const [items, setItems] = useState<SavedEntity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = () => {
    setRefreshing(true)
    setReloadKey((k) => k + 1)
  }

  useEffect(() => {
    let ignore = false
    // A pull-driven reload keeps the current rows on screen; skeletons are
    // for arriving with nothing.
    if (!refreshing) setLoading(true)
    setError(false)
    apiClient
      .get<SavedEntity[]>(`/api/saves/${slug}`)
      .then((data) => {
        if (!ignore) setItems(data)
      })
      .catch((err) => {
        console.error('[SavedListScreen] fetch failed:', err)
        if (!ignore) setError(true)
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false)
          setRefreshing(false)
        }
      })
    return () => {
      ignore = true
    }
  }, [slug, reloadKey])

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
          title={`Couldn't load your saved ${kind.noun}.`}
          hint="Check your connection and try again."
        >
          <Button
            label="Try again"
            variant="secondary"
            onPress={() => setReloadKey((k) => k + 1)}
            style={styles.retry}
          />
        </EmptyState>
      ) : items.length === 0 ? (
        <EmptyState
          icon={kind.icon}
          title="Nothing saved here yet."
          hint="The bookmark on any card puts it on this shelf."
        >
          <Button label={kind.browseLabel} variant="accent" onPress={() => router.push(kind.browse)} style={styles.retry} />
        </EmptyState>
      ) : (
        // A ScrollView, not a View: this used to be a static container, which
        // capped the shelf at one screenful — anything below the fold was
        // unreachable.
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.ink} />
          }
        >
          {items.map((item) => {
            // tutorials/challenges carry title; toys carry name.
            const label = item.title ?? item.name ?? ''
            const line = item.summary ?? item.description ?? null
            return (
              // The bookmark is a sibling of the pressable, never a child —
              // the same rule as every other saveable row.
              <View key={item.id} style={styles.saveHost}>
                <AnimatedPressable
                  onPress={() => router.push(kind.route(item.id))}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  pressScale={0.985}
                  style={styles.rowPress}
                >
                  <Card style={styles.card}>
                    <View style={styles.cardBody}>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {label}
                      </Text>
                      {line ? (
                        <Text style={styles.cardLine} numberOfLines={2}>
                          {line}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
                  </Card>
                </AnimatedPressable>
                <View style={styles.saveButtonWrap}>
                  <SaveButton slug={slug} id={item.id} saves={saves} />
                </View>
              </View>
            )
          })}
        </ScrollView>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  listContent: { paddingBottom: theme.spacing(6) },
  retry: { marginTop: theme.spacing(5), alignSelf: 'center', paddingHorizontal: theme.spacing(6) },
  saveHost: { position: 'relative', marginBottom: theme.spacing(3) },
  saveButtonWrap: { position: 'absolute', top: 2, right: 2 },
  rowPress: {},
  // paddingRight keeps a two-line title from running under the 40px island.
  card: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), padding: theme.spacing(3) },
  cardBody: { flex: 1, paddingRight: 40 },
  cardTitle: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.text, lineHeight: 22 },
  cardLine: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    lineHeight: 18,
    marginTop: theme.spacing(1),
  },
})
