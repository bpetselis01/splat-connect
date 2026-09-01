// packages/mobile/components/toys/toy-library-screen.tsx
import { useEffect, useState } from 'react'
import { View, Text, FlatList, RefreshControl, StyleSheet, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeInDown } from 'react-native-reanimated'
import type { ToyWithOwner } from '@splat-connect/types'
import { toyHolderName } from '@splat-connect/types'
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
import { Meter } from '../ui/Meter'

// Copied verbatim from packages/web/app/toy-library/toy-library-client.tsx —
// same buckets, same labels, same thresholds. Two copies rather than a shared
// import because the web file lives outside this package's dependency graph.
type ConditionBucket = 'all' | 'good' | 'fair' | 'well-loved'

const CONDITION_LABELS: Record<ConditionBucket, string> = {
  all: 'Any',
  good: 'Good (7–10)',
  fair: 'Fair (4–6)',
  'well-loved': 'Well-loved (1–3)',
}
const CONDITIONS: ConditionBucket[] = ['all', 'good', 'fair', 'well-loved']

function matchesCondition(condition: number, bucket: ConditionBucket): boolean {
  if (bucket === 'all') return true
  if (bucket === 'good') return condition >= 7
  if (bucket === 'fair') return condition >= 4 && condition <= 6
  return condition <= 3
}

function ToyRow({ item, saves, onPress }: { item: ToyWithOwner; saves: Saves; onPress: () => void }) {
  const holder = toyHolderName(item)

  return (
    // The save bookmark is a sibling of the pressable, never a child of it —
    // a nested Pressable would fight the row's own press target for the touch.
    <View style={styles.saveHost}>
      <AnimatedPressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={item.name}
        accessibilityHint={`Condition ${item.condition} of 10. Held by ${holder ?? 'SPLAT'}. Opens the toy.`}
        pressScale={0.985}
        style={styles.rowPress}
      >
        <Card style={styles.card}>
          {item.cover_photo_url ? (
            <Image source={{ uri: item.cover_photo_url }} style={styles.thumbnail} />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <Ionicons name="cube-outline" size={30} color={theme.colors.primary} />
            </View>
          )}
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.name}
            </Text>
            {/*
              Hidden from the accessibility tree on purpose: the meter carries
              its own "N of 10" label and the badges their own status words,
              both already folded into the row's hint above — leaving them
              visible here would double-announce the same facts.
            */}
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View style={styles.meterRow}>
                <Meter value={item.condition} />
                <Text style={styles.meterLine}>
                  {item.condition}/10{holder ? ` · Held by ${holder}` : ''}
                </Text>
              </View>
              {item.switch_adapted || item.owner_org_id ? (
                <View style={styles.badgeRow}>
                  {item.switch_adapted ? <Badge status="switch_adapted" label="Switch-adapted" /> : null}
                  {/* Only ever shown for an organisation: a person's toy is
                      always one unit, so "1 available" would be noise. */}
                  {item.owner_org_id ? <Badge status="available" label={`${item.quantity} available`} /> : null}
                </View>
              ) : null}
            </View>
            <View style={styles.cardFooter}>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
            </View>
          </View>
        </Card>
      </AnimatedPressable>
      <View style={styles.saveButtonWrap}>
        <SaveButton slug="toys" id={item.id} saves={saves} />
      </View>
    </View>
  )
}

function OrganisationsRow({ onPress }: { onPress: () => void }) {
  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Organisations"
      accessibilityHint="Browse organisations giving away toys."
      style={styles.orgRow}
    >
      <Ionicons name="business-outline" size={18} color={theme.colors.primary} />
      <Text style={styles.orgRowText}>Organisations</Text>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
    </AnimatedPressable>
  )
}

export function ToyLibraryScreen() {
  const router = useRouter()
  const saves = useSaves()
  const [toys, setToys] = useState<ToyWithOwner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [condition, setCondition] = useState<ConditionBucket>('all')
  const [switchAdaptedOnly, setSwitchAdaptedOnly] = useState(false)
  // Bumping this re-runs the fetch — the retry button's and pull-to-refresh's
  // shared handle.
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
    setError(null)
    apiClient
      .get<ToyWithOwner[]>('/api/public/toys')
      .then((data) => {
        if (!ignore) setToys(data)
      })
      .catch((err) => {
        console.error('[ToyLibraryScreen] toy fetch failed:', err)
        if (!ignore) setError("Couldn't load toys.")
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
  }, [reloadKey])

  // Every published toy is already loaded (the endpoint isn't paged), so all
  // three filters run client-side, same as web's toy-library-client.tsx.
  const q = search.trim().toLowerCase()
  const visible = toys.filter((t) => {
    const matchesSearch = !q || t.name.toLowerCase().includes(q)
    const matchesSwitch = !switchAdaptedOnly || t.switch_adapted
    return matchesSearch && matchesCondition(t.condition, condition) && matchesSwitch
  })

  // One always-mounted list: header, search and filters live inside it as
  // ListHeaderComponent so they scroll away with the content instead of
  // pinning the top half of the screen (they used to sit above the list as
  // fixed views). Loading/error/empty render through ListEmptyComponent so
  // the header holds across every state.
  return (
    <Screen>
      <FlatList
        key={condition}
        data={loading || error ? [] : visible}
        keyExtractor={(t) => t.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.ink} />
        }
        ListHeaderComponent={
          <>
            <View style={styles.headerRow}>
              <View style={styles.headerTitle}>
                <ScreenHeader
                  title="Toy Library"
                  subtitle="Adapted toys that families and organisations are giving away."
                  showLogo
                />
              </View>
              <Button
                label="+ Give a toy"
                variant="accent"
                onPress={() => router.push('/toys/new')}
                style={styles.giveToy}
              />
            </View>

            <TextField
              icon="search"
              placeholder="Search by toy name"
              value={search}
              onChangeText={setSearch}
              boxStyle={styles.searchBar}
            />

            <View style={styles.filterRow}>
              {CONDITIONS.map((c) => (
                <Chip key={c} label={CONDITION_LABELS[c]} active={condition === c} onPress={() => setCondition(c)} />
              ))}
            </View>

            <View style={styles.divider} />

            <View style={[styles.filterRow, styles.switchRow]}>
              <Chip
                label="Switch-adapted"
                active={switchAdaptedOnly}
                onPress={() => setSwitchAdaptedOnly((v) => !v)}
              />
            </View>

            {!loading && !error ? (
              <Text style={styles.countLine}>
                {visible.length} toy{visible.length === 1 ? '' : 's'}
              </Text>
            ) : null}
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </View>
          ) : error ? (
            <EmptyState icon="cloud-offline-outline" title="Couldn't load toys." hint="Check your connection and try again.">
              <Button label="Try again" variant="secondary" onPress={() => setReloadKey((k) => k + 1)} style={styles.retry} />
            </EmptyState>
          ) : (
            <EmptyState
              icon="search-outline"
              title="No toys here yet"
              hint={
                search
                  ? `Nothing matches "${search}". Try a different word, or clear the search.`
                  : 'Try another condition — new toys are added as they are shared.'
              }
            />
          )
        }
        renderItem={({ item, index }) => (
          // Past the first screenful the stagger is invisible and only adds
          // latency, so the delay is capped rather than growing with the index.
          <Animated.View
            entering={FadeInDown.delay(Math.min(index, 7) * theme.motion.stagger).duration(theme.motion.base)}
          >
            <ToyRow
              item={item}
              saves={saves}
              onPress={() => router.push(`/toy-library/${item.id}`)}
            />
          </Animated.View>
        )}
        ListFooterComponent={
          !loading && !error ? <OrganisationsRow onPress={() => router.push('/toy-library/organisations')} /> : null
        }
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing(2) },
  headerTitle: { flex: 1 },
  giveToy: { paddingVertical: theme.spacing(2), paddingHorizontal: theme.spacing(3) },
  searchBar: {
    borderRadius: theme.radii.md,
    borderWidth: theme.border.thin,
    paddingHorizontal: theme.spacing(4),
    ...theme.shadow(4),
  },
  filterRow: { flexDirection: 'row', gap: theme.spacing(2), marginBottom: theme.spacing(2) },
  switchRow: { marginBottom: theme.spacing(4) },
  divider: { height: 2, backgroundColor: theme.colors.border, marginBottom: theme.spacing(2) },
  countLine: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    marginBottom: theme.spacing(2),
  },
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
  // paddingRight leaves room for the save island (40x40, top-right of the
  // card) so a two-line title never runs under it.
  cardBody: { flex: 1, justifyContent: 'space-between', paddingVertical: theme.spacing(1), paddingRight: 40 },
  cardTitle: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
    fontSize: theme.type.heading,
    lineHeight: 24,
  },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2), marginTop: theme.spacing(1) },
  meterLine: {
    fontFamily: theme.fonts.regular,
    color: theme.colors.muted,
    fontSize: 11,
  },
  badgeRow: { flexDirection: 'row', gap: theme.spacing(2), marginTop: theme.spacing(2) },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: theme.spacing(2),
  },
  orgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
    borderWidth: theme.border.thin,
    borderStyle: 'dashed',
    borderColor: theme.colors.primary,
    borderRadius: theme.radii.md,
    paddingVertical: theme.spacing(3),
    paddingHorizontal: theme.spacing(4),
    marginTop: theme.spacing(1),
  },
  orgRowText: {
    flex: 1,
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.label,
    color: theme.colors.primaryDeep,
  },
})
