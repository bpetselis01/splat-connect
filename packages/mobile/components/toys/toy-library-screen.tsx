// packages/mobile/components/toys/toy-library-screen.tsx
//
// The Toy library tab, as the board draws it (#toy_library): the same
// row-card idiom as Guides so the two tabs read as one app — greeting and
// mascot, Toys / Organisations, a Filters button that unfolds the chips, a heading with the
// count, then cards carrying status, Wired, a plain-language condition grade
// and the holder.
import { useEffect, useState } from 'react'
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeInDown } from 'react-native-reanimated'
import type { ToyWithOwner } from '@splat-connect/types'
import { gradeOf, GRADES, toyHolderName, type GradeKey } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { theme } from '../../lib/theme'
import { tabBarClearance } from '../../lib/tab-bar-layout'
import { scrollFrame, scrollContent, SEARCH_GAP } from '../../lib/layout'
import { useSaves } from '../../lib/saves'
import { Chip } from '../ui/Chip'
import { FilterPanel } from '../ui/FilterPanel'
import { TextField } from '../ui/TextField'
import { Screen } from '../ui/Screen'
import { Button } from '../ui/Button'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { Badge } from '../ui/Badge'
import { SaveButton } from '../ui/SaveButton'
import { CornerMenu } from '../ui/CornerMenu'
import { Segmented } from '../ui/Segmented'
import { TabHero } from '../ui/TabHero'
import { RowCard, MetaItem } from '../ui/RowCard'
import { useCapabilities } from '../../lib/capabilities'
import { nearParam } from '../../lib/near'

type IconName = React.ComponentProps<typeof Ionicons>['name']

/** The board's grade look: one icon and tint per word. The words are types'. */
const GRADE_LOOK: Record<GradeKey, { icon: IconName; bg: string }> = {
  'like-new': { icon: 'sparkles-outline', bg: theme.colors.successSoft },
  good: { icon: 'checkmark-circle-outline', bg: theme.colors.mintSoft },
  'well-loved': { icon: 'heart-outline', bg: theme.colors.honeySoft },
  'needs-fix': { icon: 'build-outline', bg: theme.colors.apricotSoft },
}

function conditionGrade(c: number): { label: string; icon: IconName; bg: string } {
  const g = gradeOf(c)
  return { label: g.label, ...GRADE_LOOK[g.key] }
}

const TINTS = [
  theme.colors.accentLight,
  theme.colors.mintSoft,
  theme.colors.apricotSoft,
  theme.colors.violetSoft,
  theme.colors.honeySoft,
]

export function ToyLibraryScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const saves = useSaves()
  const { caps, loading: capsLoading } = useCapabilities()
  const [toys, setToys] = useState<Array<ToyWithOwner & { km?: number | null }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [condition, setCondition] = useState<GradeKey | null>(null)
  const [switchAdaptedOnly, setSwitchAdaptedOnly] = useState(false)
  const [availableOnly, setAvailableOnly] = useState(false)
  const [newest, setNewest] = useState(false)
  const [nearest, setNearest] = useState(false)
  const postcode = nearParam(caps?.profile.pickup_postcode)
  // Bumping this re-runs the fetch — the retry button's and pull-to-refresh's
  // shared handle.
  const [reloadKey, setReloadKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = () => {
    setRefreshing(true)
    setReloadKey((k) => k + 1)
  }

  const clearFilters = () => {
    setSearch('')
    setCondition(null)
    setSwitchAdaptedOnly(false)
    setAvailableOnly(false)
  }

  useEffect(() => {
    let ignore = false
    if (!refreshing) setLoading(true)
    setError(null)
    apiClient
      .get<Array<ToyWithOwner & { km?: number | null }>>(
        nearest && postcode ? `/api/public/toys?near=${encodeURIComponent(postcode)}` : '/api/public/toys'
      )
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
  }, [reloadKey, nearest, postcode])

  // Every published toy is already loaded (the endpoint isn't paged), so every
  // filter runs client-side, same as web's toy-library-client.tsx.
  const q = search.trim().toLowerCase()
  const visible = toys.filter(
    (t) =>
      (!q || t.name.toLowerCase().includes(q)) &&
      (!condition || gradeOf(t.condition).key === condition) &&
      (!switchAdaptedOnly || t.switch_adapted) &&
      // A person's toy is one unit; an organisation's may run out without the
      // row going away, and that is the only "not available" a public toy has.
      (!availableOnly || t.quantity > 0)
  )
  if (newest) visible.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
  const filtered = !!q || !!condition || switchAdaptedOnly || availableOnly
  const activeCount = [!!condition, switchAdaptedOnly, availableOnly, newest, nearest].filter(Boolean).length
  const heading = filtered ? 'Matching toys' : newest ? 'Newest first' : nearest ? 'Nearest first' : 'All toys'

  return (
    <Screen ownHeader>
      <FlatList
        data={loading || error ? [] : visible}
        // The filters are part of each row's key so a new filter replays the
        // rows' entrance without remounting the header.
        keyExtractor={(t) => `${condition ?? 'any'}:${t.id}`}
        showsVerticalScrollIndicator={false}
        style={scrollFrame}
        contentContainerStyle={[scrollContent, { paddingBottom: tabBarClearance(insets.bottom) }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.ink} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <TabHero greeting="Given by families near you" title="Toy library" pose="hold" />

            {/* Organisations is a place, not a filter, so choosing it goes
                there; the switch always shows Toys as where you are. */}
            <Segmented
              label="Browse"
              variant="tint"
              options={[
                { value: 'toys', label: 'Toys' },
                { value: 'orgs', label: 'Organisations' },
              ]}
              value="toys"
              onChange={(v) => {
                if (v === 'orgs') router.push('/toy-library/organisations')
              }}
            />

            <TextField
              icon="search"
              placeholder="Search by toy name"
              value={search}
              onChangeText={setSearch}
              boxStyle={styles.searchBar}
              search
            />

            <FilterPanel activeCount={activeCount}>
              <Chip
                variant="filter"
                icon="checkmark-circle-outline"
                label="Available"
                active={availableOnly}
                onPress={() => setAvailableOnly((v) => !v)}
              />
              <Chip
                variant="filter"
                icon="flash-outline"
                label="Switch-adapted"
                active={switchAdaptedOnly}
                onPress={() => setSwitchAdaptedOnly((v) => !v)}
              />
              <Chip variant="filter" icon="time-outline" label="Newest" active={newest} onPress={() => setNewest((v) => !v)} />
              {capsLoading ? null : postcode ? (
                <Chip variant="filter" icon="navigate-outline" label="Nearest first" active={nearest} onPress={() => setNearest((v) => !v)} />
              ) : (
                <Chip variant="filter" icon="navigate-outline" label="Add your postcode" active={false} onPress={() => router.push('/account')} />
              )}
              {GRADES.map((g) => (
                <Chip
                  key={g.key}
                  variant="filter"
                  label={g.label}
                  active={condition === g.key}
                  onPress={() => setCondition((cur) => (cur === g.key ? null : g.key))}
                />
              ))}
            </FilterPanel>

            {!loading && !error ? (
              <View style={styles.headingRow}>
                <Text style={styles.heading} accessibilityRole="header">
                  {heading}
                </Text>
                <Text style={styles.count}>
                  {visible.length} toy{visible.length === 1 ? '' : 's'}
                </Text>
              </View>
            ) : null}
          </View>
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
                  : 'Try removing a filter — new toys are added as they are shared.'
              }
            >
              {filtered ? <Button label="Clear filters" variant="secondary" onPress={clearFilters} style={styles.retry} /> : null}
            </EmptyState>
          )
        }
        renderItem={({ item, index }) => {
          const holder = toyHolderName(item)
          const grade = conditionGrade(item.condition)
          const available = item.quantity > 0
          return (
            <Animated.View
              entering={FadeInDown.delay(Math.min(index, 7) * theme.motion.stagger).duration(theme.motion.base)}
            >
              <RowCard
                title={item.name}
                photo={item.cover_photo_url}
                icon="cube-outline"
                tint={TINTS[index % TINTS.length]}
                accessibilityHint={`${grade.label}, condition ${item.condition} of 10. Held by ${holder ?? 'SPLAT'}. Opens the toy.`}
                onPress={() => router.push(`/toy-library/${item.id}`)}
                pills={
                  <>
                    {/* Only an organisation's count says anything: a person's
                        toy is always one unit, so "1 available" is noise. */}
                    <Badge
                      status="available"
                      label={item.owner_org_id ? `${item.quantity} available` : available ? 'Available' : 'None left'}
                      icon="checkmark-circle"
                      bg={available ? theme.colors.successSoft : theme.colors.surfaceSunken}
                    />
                    {item.switch_adapted ? (
                      <Badge status="switch_adapted" label="Switch-adapted" icon="flash" bg={theme.colors.accentLight} />
                    ) : null}
                  </>
                }
                meta={
                  <View style={styles.meta}>
                    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                      <Badge status="grade" label={grade.label} icon={grade.icon} bg={grade.bg} />
                    </View>
                    {holder ? <MetaItem icon="location-outline">{holder}</MetaItem> : null}
                    {item.km != null ? <MetaItem icon="navigate-outline">{`${item.km} km`}</MetaItem> : null}
                  </View>
                }
                aside={<SaveButton slug="toys" id={item.id} saves={saves} />}
              />
            </Animated.View>
          )
        }}
      />
      <CornerMenu
        label="Toy actions"
        items={[
          { label: 'Give a toy', icon: 'add', href: '/toys/new', primary: true },
          { label: 'My toys', icon: 'cube-outline', href: '/toys' },
          { label: 'My exchanges', icon: 'swap-horizontal-outline', href: '/exchanges', count: caps?.exchangeActions },
          { label: 'Saved toys', icon: 'heart-outline', href: '/saved/toys' },
        ]}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { gap: SEARCH_GAP, marginBottom: theme.spacing(4) },
  searchBar: {
    borderRadius: theme.radii.pill,
    borderWidth: theme.border.hairline,
    paddingHorizontal: theme.spacing(4),
    minHeight: 52,
    ...theme.shadow(1),
  },
  headingRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  heading: { fontFamily: theme.fonts.display, fontSize: theme.type.heading, lineHeight: 26, color: theme.colors.ink },
  count: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.muted },
  meta: { gap: 6, alignItems: 'flex-start' },
  retry: { marginTop: theme.spacing(5), alignSelf: 'center', paddingHorizontal: theme.spacing(8) },
})
