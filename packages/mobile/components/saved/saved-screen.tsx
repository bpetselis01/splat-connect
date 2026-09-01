// packages/mobile/components/saved/saved-screen.tsx
// The Saved hub: three count tiles, one per type that can be saved. Mobile's
// half of web's app/dashboard/saved/page.tsx. There is no "Recently saved"
// strip: GET /api/saves/:slug already returns each list in save order, newest
// first, so the lists themselves are the recency view.
//
// Title comes from the native header (app/(my)/_layout.tsx).
import { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { SavedIds, SaveSlug } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { SkeletonRow } from '../ui/Skeleton'
import { AnimatedPressable } from '../ui/AnimatedPressable'

const TILES: { slug: SaveSlug; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { slug: 'tutorials', label: 'Guides', icon: 'book-outline' },
  { slug: 'toys', label: 'Toys', icon: 'cube-outline' },
  { slug: 'challenges', label: 'Challenges', icon: 'bulb-outline' },
]

const NONE: SavedIds = { tutorials: [], toys: [], challenges: [] }

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
          {TILES.map(({ slug, label, icon }) => {
            const count = ids[slug].length
            return (
              <AnimatedPressable
                key={slug}
                onPress={() => router.push(`/saved/${slug}`)}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityHint={count ? `${count} saved. Opens the list.` : 'Nothing saved yet. Opens the list.'}
                pressScale={0.985}
                style={styles.tilePress}
              >
                <Card style={styles.tile}>
                  <View style={styles.tileIcon}>
                    <Ionicons name={icon} size={22} color={theme.colors.primaryDeep} />
                  </View>
                  <Text style={styles.tileLabel}>{label}</Text>
                  {/* Jersey-10 numeral, the same treatment as the hub's counts. */}
                  <Text style={styles.tileCount}>{count}</Text>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
                </Card>
              </AnimatedPressable>
            )
          })}
        </View>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  retry: { marginTop: theme.spacing(5), alignSelf: 'center', paddingHorizontal: theme.spacing(8) },
  tilePress: { marginBottom: theme.spacing(3) },
  tile: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), padding: theme.spacing(3) },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.md,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: { flex: 1, fontFamily: theme.fonts.bold, fontSize: theme.type.heading, color: theme.colors.text },
  tileCount: {
    fontFamily: theme.fonts.numeral,
    fontSize: 22,
    color: theme.colors.primaryDeep,
    marginRight: theme.spacing(1),
  },
})
