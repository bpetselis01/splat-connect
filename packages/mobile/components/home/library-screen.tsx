// packages/mobile/components/home/library-screen.tsx
import { useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeInDown } from 'react-native-reanimated'
import type { Tutorial, TutorialOrg, TutorialKind, Difficulty } from '@splat-connect/types'
import { KIND_LABEL } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { useSaves, type Saves } from '../../lib/saves'
import { ScreenHeader } from '../ui/ScreenHeader'
import { Chip } from '../ui/Chip'
import { Card } from '../ui/Card'
import { TextField } from '../ui/TextField'
import { Screen } from '../ui/Screen'
import { AnimatedPressable } from '../ui/AnimatedPressable'
import { Button } from '../ui/Button'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { Badge } from '../ui/Badge'
import { SaveButton } from '../ui/SaveButton'

const FILTERS: { label: string; value: Difficulty | null }[] = [
  { label: 'All', value: null },
  { label: 'Easy', value: 'easy' },
  { label: 'Medium', value: 'medium' },
  { label: 'Hard', value: 'hard' },
]

const KIND_FILTERS: { label: string; value: TutorialKind }[] = [
  { label: KIND_LABEL.toy_adaptation, value: 'toy_adaptation' },
  { label: KIND_LABEL.assistive_tech, value: 'assistive_tech' },
]

/** The public list embeds only accepted backings on each row. */
type ListedTutorial = Tutorial & { tutorial_orgs?: TutorialOrg[] }

// "Reviewed by SPLAT" is the default path, not an absence — every contributor
// took it before organisations existed, so it gets equal billing with a name.
function backing(t: ListedTutorial): string {
  const accepted = (t.tutorial_orgs ?? []).find((o) => o.status === 'accepted')
  return accepted ? `Backed by ${accepted.organizations?.name ?? 'an organisation'}` : 'Reviewed by SPLAT'
}

function TutorialRow({
  item,
  saves,
  onPress,
}: {
  item: ListedTutorial
  saves: Saves
  onPress: () => void
}) {
  return (
    // The save bookmark is a sibling of the pressable, never a child of it —
    // a nested Pressable would fight the row's own press target for the touch.
    <View style={styles.saveHost}>
      <AnimatedPressable
        onPress={onPress}
        accessibilityRole="button"
        // Without an explicit label the row's accessible name is assembled from
        // every descendant Text, so the difficulty badge made the card answer to
        // "Hard" alongside the filter chip. The hint carries the difficulty
        // instead, where it cannot collide with another control's name.
        accessibilityLabel={item.title}
        accessibilityHint={`${item.difficulty} difficulty. ${KIND_LABEL[item.kind]}. Opens the tutorial.`}
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
            <Text style={styles.backingLine}>{backing(item)}</Text>
            {item.description ? (
              <Text style={styles.cardDescription} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
            <View style={styles.cardFooter}>
              {/*
                Hidden from the accessibility tree on purpose: the row is
                already a button, and nested "Hard" / "Toy adaptation" text
                nodes would both double-announce the value and make the row
                answer to the same spoken name as the matching filter chip —
                casing doesn't survive speech synthesis, so the kind badge
                needs this exactly as much as the difficulty badge does. The
                row's hint carries both instead.
              */}
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.badgeRow}>
                <Badge status={item.difficulty} />
                <Badge status={item.kind} label={KIND_LABEL[item.kind]} />
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
            </View>
          </View>
        </Card>
      </AnimatedPressable>
      <View style={styles.saveButtonWrap}>
        <SaveButton slug="tutorials" id={item.id} saves={saves} />
      </View>
    </View>
  )
}

export function LibraryScreen() {
  const router = useRouter()
  const saves = useSaves()
  const [tutorials, setTutorials] = useState<ListedTutorial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)
  const [kind, setKind] = useState<TutorialKind | null>(null)
  // Bumping this re-runs the fetch — the retry button's handle, since the error
  // state is a static view with no pull-to-refresh to lean on.
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError(null)
    const path = difficulty ? `/api/public/tutorials?difficulty=${difficulty}` : '/api/public/tutorials'
    apiClient
      .get<ListedTutorial[]>(path)
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
  const visible = tutorials.filter((t) => {
    const matchesQuery =
      !q || t.title.toLowerCase().includes(q) || (t.description?.toLowerCase().includes(q) ?? false)
    return matchesQuery && (!kind || t.kind === kind)
  })

  return (
    <Screen>
      <ScreenHeader
        title="Guides"
        subtitle="Step-by-step guides for switch-adapting toys and building assistive tech."
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

      <View style={styles.divider} />

      <View style={[styles.filterRow, styles.kindRow]}>
        {KIND_FILTERS.map((f) => (
          <Chip
            key={f.value}
            label={f.label}
            active={kind === f.value}
            onPress={() => setKind((k) => (k === f.value ? null : f.value))}
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
                saves={saves}
                onPress={() => router.push({ pathname: '/guides/[id]', params: { id: item.id } })}
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
    borderRadius: theme.radii.md,
    borderWidth: theme.border.thin,
    paddingHorizontal: theme.spacing(4),
    ...theme.shadow(4),
  },
  filterRow: { flexDirection: 'row', gap: theme.spacing(2), marginBottom: theme.spacing(2) },
  kindRow: { marginBottom: theme.spacing(4) },
  // theme has no dedicated "line" token — colors.border is the same 2px
  // divider colour already used for the two other top-border dividers in this
  // app (preview-screen, customization-screen), so this reuses it rather than
  // adding a second name for one value.
  divider: { height: 2, backgroundColor: theme.colors.border, marginBottom: theme.spacing(2) },
  retry: { marginTop: theme.spacing(5), alignSelf: 'center', paddingHorizontal: theme.spacing(8) },
  listContent: { paddingBottom: theme.spacing(6) },
  rowPress: { marginBottom: theme.spacing(3) },
  saveHost: { position: 'relative' },
  saveButtonWrap: { position: 'absolute', top: 2, right: 2 },
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
  backingLine: {
    fontFamily: theme.fonts.regular,
    color: theme.colors.muted,
    fontSize: 11,
    marginTop: theme.spacing(1),
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing(2),
  },
  badgeRow: { flexDirection: 'row', gap: theme.spacing(2) },
})
