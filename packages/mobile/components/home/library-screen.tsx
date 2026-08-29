// packages/mobile/components/home/library-screen.tsx
import { useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeInDown } from 'react-native-reanimated'
import type { Tutorial, Difficulty } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { DifficultyBadge } from '../difficulty-badge'
import { ScreenHeader } from '../ui/ScreenHeader'
import { Chip } from '../ui/Chip'
import { Card } from '../ui/Card'
import { TextField } from '../ui/TextField'
import { Screen } from '../ui/Screen'
import { AnimatedPressable } from '../ui/AnimatedPressable'
import { Button } from '../ui/Button'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'

const FILTERS: { label: string; value: Difficulty | null }[] = [
  { label: 'All', value: null },
  { label: 'Easy', value: 'easy' },
  { label: 'Medium', value: 'medium' },
  { label: 'Hard', value: 'hard' },
]

function TutorialRow({ item, onPress }: { item: Tutorial; onPress: () => void }) {
  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      // Without an explicit label the row's accessible name is assembled from
      // every descendant Text, so the difficulty badge made the card answer to
      // "Hard" alongside the filter chip. The hint carries the difficulty
      // instead, where it cannot collide with another control's name.
      accessibilityLabel={item.title}
      accessibilityHint={`${item.difficulty} difficulty. Opens the tutorial.`}
      // Full-width surfaces need less travel than a button, or the press
      // reads as the card tipping over.
      pressScale={0.985}
      style={styles.rowPress}
    >
      <Card style={styles.card}>
        {item.toy_photo_url ? (
          <Image source={{ uri: item.toy_photo_url }} style={styles.thumbnail} />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Ionicons name="color-wand-outline" size={30} color={theme.colors.primary} />
          </View>
        )}
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>
          {item.description ? (
            <Text style={styles.cardDescription} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}
          <View style={styles.cardFooter}>
            {/*
              Hidden from the accessibility tree on purpose: the row is already
              a button, and a nested "Hard" text node would both double-announce
              the difficulty and make the row answer to the same accessible name
              as the "Hard" filter chip. The row's hint carries it instead.
            */}
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <DifficultyBadge difficulty={item.difficulty} />
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
          </View>
        </View>
      </Card>
    </AnimatedPressable>
  )
}

export function LibraryScreen() {
  const router = useRouter()
  const [tutorials, setTutorials] = useState<Tutorial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)
  // Bumping this re-runs the fetch — the retry button's handle, since the error
  // state is a static view with no pull-to-refresh to lean on.
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError(null)
    const path = difficulty ? `/api/public/tutorials?difficulty=${difficulty}` : '/api/public/tutorials'
    apiClient
      .get<Tutorial[]>(path)
      .then((data) => {
        if (!ignore) setTutorials(data)
      })
      .catch((err) => {
        console.error('[LibraryScreen] tutorial fetch failed:', err)
        if (!ignore) setError("Couldn't load tutorials.")
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [difficulty, reloadKey])

  // The whole approved set is already loaded (the endpoint isn't paged), so this
  // client-side match is complete — it just has to look past the title. Matching
  // the description too stops "search" from silently missing tutorials whose
  // relevant words live in the blurb rather than the name.
  const q = search.trim().toLowerCase()
  const visible = q
    ? tutorials.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description?.toLowerCase().includes(q) ?? false)
      )
    : tutorials

  return (
    <Screen>
      <ScreenHeader
        title="Tutorial Library"
        subtitle="Step-by-step guides for switch-adapting your child's toys."
        showLogo
      />

      <TextField
        icon="search"
        placeholder="Search tutorials"
        value={search}
        onChangeText={setSearch}
        boxStyle={styles.searchBar}
      />

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Chip
            key={f.label}
            label={f.label}
            active={difficulty === f.value}
            onPress={() => setDifficulty(f.value)}
          />
        ))}
      </View>

      {loading ? (
        <View>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      ) : error ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load tutorials."
          hint="Check your connection and try again."
        >
          <Button
            label="Try again"
            variant="secondary"
            onPress={() => setReloadKey((k) => k + 1)}
            style={styles.retry}
          />
        </EmptyState>
      ) : visible.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title="No tutorials here yet"
          hint={
            search
              ? `Nothing matches "${search}". Try a different word, or clear the search.`
              : 'Try another difficulty — new guides are added as contributors share them.'
          }
        />
      ) : (
        <FlatList
          key={`${difficulty ?? 'all'}`}
          data={visible}
          keyExtractor={(t) => t.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            // Past the first screenful the stagger is invisible and only adds
            // latency, so the delay is capped rather than growing with the index.
            <Animated.View
              entering={FadeInDown.delay(Math.min(index, 7) * theme.motion.stagger).duration(
                theme.motion.base
              )}
            >
              <TutorialRow
                item={item}
                onPress={() => router.push({ pathname: '/home/[id]', params: { id: item.id } })}
              />
            </Animated.View>
          )}
        />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  searchBar: {
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing(4),
    ...theme.elevation.rest,
  },
  filterRow: { flexDirection: 'row', gap: theme.spacing(2), marginBottom: theme.spacing(4) },
  retry: { marginTop: theme.spacing(5), alignSelf: 'center', paddingHorizontal: theme.spacing(8) },
  listContent: { paddingBottom: theme.spacing(6) },
  rowPress: { marginBottom: theme.spacing(3) },
  card: { flexDirection: 'row', gap: theme.spacing(4), padding: theme.spacing(3) },
  thumbnail: {
    width: 104,
    height: 104,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surfaceSunken,
  },
  thumbnailPlaceholder: {
    width: 104,
    height: 104,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, justifyContent: 'space-between', paddingVertical: theme.spacing(1) },
  cardTitle: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
    fontSize: theme.type.heading,
    lineHeight: 24,
  },
  cardDescription: {
    fontFamily: theme.fonts.regular,
    color: theme.colors.muted,
    fontSize: theme.type.caption,
    lineHeight: 18,
    marginTop: theme.spacing(1),
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing(2),
  },
})
