// packages/mobile/components/home/library-screen.tsx
import { useEffect, useState } from 'react'
import { View, Text, TextInput, StyleSheet, Image, type TextStyle } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import type { Tutorial, Difficulty } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { DifficultyBadge } from '../difficulty-badge'
import { ScreenHeader } from '../ui/ScreenHeader'
import { Chip } from '../ui/Chip'
import { Card } from '../ui/Card'
import { StaggeredList } from '../ui/StaggeredList'
import { Screen } from '../ui/Screen'
import { AnimatedPressable } from '../ui/AnimatedPressable'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'

// react-native-web paints the browser's default focus ring on a focused
// TextInput: a square outline that ignores the pill radius and escapes its
// container. The animated border below is the focus indicator, so this
// suppresses a duplicate rather than removing the only one. `outlineStyle` is
// web-only and absent from React Native's TextStyle, hence the cast.
const noWebOutline = { outlineStyle: 'none' } as unknown as TextStyle

const FILTERS: { label: string; value: Difficulty | null }[] = [
  { label: 'All', value: null },
  { label: 'Easy', value: 'easy' },
  { label: 'Medium', value: 'medium' },
  { label: 'Hard', value: 'hard' },
]

/** The search field grows a brand-coloured ring on focus rather than cutting to it. */
function SearchField({ value, onChangeText }: { value: string; onChangeText: (v: string) => void }) {
  const focus = useSharedValue(0)

  const ring = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focus.value,
      [0, 1],
      [theme.colors.border, theme.colors.primary]
    ),
  }))

  return (
    <Animated.View style={[styles.searchBar, ring]}>
      <Ionicons name="search" size={19} color={theme.colors.muted} style={styles.searchIcon} />
      <TextInput
        style={styles.searchInput}
        placeholder="Search tutorials"
        placeholderTextColor={theme.colors.muted}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => {
          focus.value = withTiming(1, { duration: theme.motion.fast })
        }}
        onBlur={() => {
          focus.value = withTiming(0, { duration: theme.motion.fast })
        }}
      />
    </Animated.View>
  )
}

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
        if (!ignore) setError("Couldn't load tutorials. Pull to retry.")
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [difficulty])

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

      <SearchField value={search} onChangeText={setSearch} />

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
        <EmptyState icon="cloud-offline-outline" title="Couldn't load tutorials. Pull to retry." />
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
        <StaggeredList
          key={`${difficulty ?? 'all'}`}
          data={visible}
          keyExtractor={(t) => t.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TutorialRow
              item={item}
              onPress={() => router.push({ pathname: '/home/[id]', params: { id: item.id } })}
            />
          )}
        />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.radii.pill,
    borderWidth: 1.5,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing(4),
    marginBottom: theme.spacing(3),
    ...theme.elevation.rest,
  },
  searchIcon: { marginRight: theme.spacing(2) },
  searchInput: {
    flex: 1,
    paddingVertical: theme.spacing(3),
    minHeight: 48,
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.body,
    color: theme.colors.text,
    ...noWebOutline,
  },
  filterRow: { flexDirection: 'row', gap: theme.spacing(2), marginBottom: theme.spacing(4) },
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
