// packages/mobile/components/toys/toy-library-screen.tsx
//
// The Toy library tab, as the board draws it (#toy_library): the same
// row-card idiom as Guides so the two tabs read as one app — greeting and
// mascot, Toys / Organisations, a row of filter chips, a heading with the
// count, then cards carrying status, Wired, a plain-language condition grade
// and the holder.
import { useEffect, useState } from 'react'
import { View, Text, FlatList, RefreshControl, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeInDown } from 'react-native-reanimated'
import type { ToyWithOwner } from '@splat-connect/types'
import { toyHolderName } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { useSaves } from '../../lib/saves'
import { Chip } from '../ui/Chip'
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

type IconName = React.ComponentProps<typeof Ionicons>['name']

// The same buckets and thresholds as web's toy-library-client.tsx, now chips.
type ConditionBucket = 'good' | 'fair' | 'well-loved'
const CONDITIONS: { value: ConditionBucket; label: string }[] = [
  { value: 'good', label: 'Good (7–10)' },
  { value: 'fair', label: 'Fair (4–6)' },
  { value: 'well-loved', label: 'Well-loved (1–3)' },
]

function matchesCondition(condition: number, bucket: ConditionBucket | null): boolean {
  if (!bucket) return true
  if (bucket === 'good') return condition >= 7
  if (bucket === 'fair') return condition >= 4 && condition <= 6
  return condition <= 3
}

/**
 * The board's condition grade: a description of the toy in words, never a
 * score. Same cut points as the board's GRADE().
 */
function conditionGrade(c: number): { label: string; icon: IconName; bg: string } {
  if (c >= 9) return { label: 'Like new', icon: 'sparkles-outline', bg: theme.colors.successSoft }
  if (c >= 7) return { label: 'Good', icon: 'checkmark-circle-outline', bg: theme.colors.mintSoft }
  if (c >= 5) return { label: 'Well-loved', icon: 'heart-outline', bg: theme.colors.honeySoft }
  return { label: 'Needs a fix', icon: 'build-outline', bg: theme.colors.apricotSoft }
}

const TINTS = [
  theme.colors.accentLight,
  theme.colors.mintSoft,
  theme.colors.apricotSoft,
  theme.colors.violetSoft,
  theme.colors.honeySoft,
]

export function ToyLibraryScreen() {
  const router = useRouter()
  const saves = useSaves()
  const { caps } = useCapabilities()
  const [toys, setToys] = useState<ToyWithOwner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [condition, setCondition] = useState<ConditionBucket | null>(null)
  const [switchAdaptedOnly, setSwitchAdaptedOnly] = useState(false)
  const [availableOnly, setAvailableOnly] = useState(false)
  const [newest, setNewest] = useState(false)
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

  // Every published toy is already loaded (the endpoint isn't paged), so every
  // filter runs client-side, same as web's toy-library-client.tsx.
  const q = search.trim().toLowerCase()
  const visible = toys.filter(
    (t) =>
      (!q || t.name.toLowerCase().includes(q)) &&
      matchesCondition(t.condition, condition) &&
      (!switchAdaptedOnly || t.switch_adapted) &&
      // A person's toy is one unit; an organisation's may run out without the
      // row going away, and that is the only "not available" a public toy has.
      (!availableOnly || t.quantity > 0)
  )
  if (newest) visible.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
  const filtered = !!q || !!condition || switchAdaptedOnly || availableOnly
  // The board says "Nearest first", but no toy carries a place yet — a
  // heading that claimed an order the list does not have would be a lie.
  const heading = filtered ? 'Matching toys' : newest ? 'Newest first' : 'All toys'

  return (
    <Screen ownHeader>
      <FlatList
        data={loading || error ? [] : visible}
        // The filters are part of each row's key so a new filter replays the
        // rows' entrance without remounting the header.
        keyExtractor={(t) => `${condition ?? 'any'}:${t.id}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
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

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipScroller}
              contentContainerStyle={styles.chipRow}
              keyboardShouldPersistTaps="handled"
            >
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
              {CONDITIONS.map((c) => (
                <Chip
                  key={c.value}
                  variant="filter"
                  label={c.label}
                  active={condition === c.value}
                  onPress={() => setCondition((cur) => (cur === c.value ? null : c.value))}
                />
              ))}
            </ScrollView>

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
            />
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
  header: { gap: theme.spacing(4), marginBottom: theme.spacing(4) },
  searchBar: {
    borderRadius: theme.radii.pill,
    borderWidth: theme.border.hairline,
    paddingHorizontal: theme.spacing(4),
    minHeight: 52,
    ...theme.shadow(1),
  },
  chipScroller: { marginHorizontal: -theme.spacing(4) },
  chipRow: { gap: theme.spacing(2), paddingHorizontal: theme.spacing(4), paddingVertical: 4 },
  headingRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  heading: { fontFamily: theme.fonts.display, fontSize: 20, lineHeight: 26, color: theme.colors.ink },
  count: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.muted },
  meta: { gap: 6, alignItems: 'flex-start' },
  retry: { marginTop: theme.spacing(5), alignSelf: 'center', paddingHorizontal: theme.spacing(8) },
  listContent: { paddingBottom: theme.spacing(20) },
})
