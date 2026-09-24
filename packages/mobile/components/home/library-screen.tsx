// packages/mobile/components/home/library-screen.tsx
//
// The Guides tab, as the board draws it (#guides): greeting and mascot, the
// guide-type switch, search, a scrolling row of filter chips, a section
// heading with a sort control, then row cards.
import { useEffect, useState } from 'react'
import { View, Text, FlatList, RefreshControl, ScrollView, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeInDown } from 'react-native-reanimated'
import type { Tutorial, TutorialOrg, TutorialKind, Difficulty } from '@splat-connect/types'
import { KIND_LABEL, fitLine, formatBuildTime } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { useSaves } from '../../lib/saves'
import { useMyChildren } from '../../lib/my-children'
import { useCapabilities } from '../../lib/capabilities'
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

type IconName = React.ComponentProps<typeof Ionicons>['name']

const DIFFICULTY: { label: string; value: Difficulty; icon: IconName }[] = [
  { label: 'Easy', value: 'easy', icon: 'happy-outline' },
  { label: 'Medium', value: 'medium', icon: 'contrast-outline' },
  { label: 'Hard', value: 'hard', icon: 'flame-outline' },
]
const DIFF_PILL: Record<Difficulty, { icon: IconName; bg: string }> = {
  easy: { icon: 'happy', bg: theme.colors.successSoft },
  medium: { icon: 'contrast', bg: theme.colors.honeySoft },
  hard: { icon: 'flame', bg: theme.colors.apricotSoft },
}
const DIFF_RANK: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 }

type KindFilter = 'all' | TutorialKind
const KINDS: { value: KindFilter; label: string; icon: IconName }[] = [
  { value: 'all', label: 'All', icon: 'grid-outline' },
  { value: 'toy_adaptation', label: KIND_LABEL.toy_adaptation, icon: 'paw-outline' },
  { value: 'assistive_tech', label: KIND_LABEL.assistive_tech, icon: 'construct-outline' },
]

// The board's sort: a field plus a direction flip, same control as web.
type SortKey = 'new' | 'diff' | 'time'
const SORTS: { key: SortKey; label: string; hint: string; asc: boolean; words: [string, string] }[] = [
  { key: 'new', label: 'Date added', hint: 'Newest ↔ oldest', asc: false, words: ['Oldest', 'Newest'] },
  { key: 'diff', label: 'Difficulty', hint: 'Easiest ↔ hardest', asc: true, words: ['Easiest', 'Hardest'] },
  { key: 'time', label: 'Build time', hint: 'Quickest ↔ longest', asc: true, words: ['Quickest', 'Longest'] },
]

// The tile when a guide has no photo: the board's duotone glyph on a rotating
// tint, so a page of photo-less guides is not one grey block.
const TINTS = [
  theme.colors.violetSoft,
  theme.colors.accentLight,
  theme.colors.mintSoft,
  theme.colors.honeySoft,
  theme.colors.apricotSoft,
]

/** The public list embeds only accepted backings on each row. */
type ListedTutorial = Tutorial & { tutorial_orgs?: TutorialOrg[] }

function backer(t: ListedTutorial): string | null {
  const accepted = (t.tutorial_orgs ?? []).find((o) => o.status === 'accepted')
  return accepted ? (accepted.organizations?.name ?? 'an organisation') : null
}

function sortValue(t: ListedTutorial, key: SortKey): number {
  if (key === 'diff') return DIFF_RANK[t.difficulty]
  // A draft is the only guide without a time, and none is public; the
  // fallback just keeps an odd row from jumping to the top.
  if (key === 'time') return t.build_minutes ?? Number.MAX_SAFE_INTEGER
  return Date.parse(t.created_at) || 0
}

function greetingFor(hour: number): string {
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
}

export function LibraryScreen() {
  const router = useRouter()
  const saves = useSaves()
  const { caps } = useCapabilities()
  const [tutorials, setTutorials] = useState<ListedTutorial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)
  const [kind, setKind] = useState<KindFilter>('all')
  const [quick, setQuick] = useState(false)
  const [printable, setPrintable] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('new')
  const [asc, setAsc] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  // The board's "Suits Ollie" (080): the guides that suit one of the parent's
  // children. Never shown when none do — the screen then says nothing.
  const children = useMyChildren()
  const [suitsOnly, setSuitsOnly] = useState(false)
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
        if (!ignore) {
          setLoading(false)
          setRefreshing(false)
        }
      })
    return () => {
      ignore = true
    }
  }, [difficulty, reloadKey])

  const suits = new Set(tutorials.filter((t) => fitLine(t, children)).map((t) => t.id))
  const named = children.filter((c) => c.name?.trim())
  const suitsLabel = `Suits ${children.length === 1 && named.length === 1 ? named[0].name!.trim() : 'your child'}`

  // The whole approved set is already loaded (the endpoint isn't paged), so this
  // client-side match is complete — it just has to look past the title.
  const q = search.trim().toLowerCase()
  const sort = SORTS.find((s) => s.key === sortKey)!
  const visible = tutorials
    .filter((t) => {
      const matchesQuery =
        !q || t.title.toLowerCase().includes(q) || (t.description?.toLowerCase().includes(q) ?? false)
      return (
        matchesQuery &&
        (kind === 'all' || t.kind === kind) &&
        (!suitsOnly || suits.has(t.id)) &&
        (!quick || (t.build_minutes != null && t.build_minutes <= 30)) &&
        (!printable || !!t.has_stl)
      )
    })
    .sort((a, b) => (sortValue(a, sortKey) - sortValue(b, sortKey)) * (asc ? 1 : -1))

  const filtered = !!difficulty || quick || printable || kind !== 'all' || !!q
  const heading = suitsOnly ? suitsLabel : filtered ? 'Matching guides' : 'All guides'
  const firstName = caps?.profile.name.trim().split(/\s+/)[0]
  const greeting = `${greetingFor(new Date().getHours())}${firstName ? `, ${firstName}` : ''}`

  const pickSort = (key: SortKey) => {
    setSortKey(key)
    setAsc(SORTS.find((s) => s.key === key)!.asc)
    setSortOpen(false)
  }

  // One always-mounted list: header, search and filters live inside it as
  // ListHeaderComponent so they scroll away with the content. Loading/error/
  // empty render through ListEmptyComponent so the header holds across states.
  return (
    <Screen ownHeader>
      <FlatList
        data={loading || error ? [] : visible}
        // The filter is part of each row's key so a new difficulty replays the
        // rows' entrance without remounting the header.
        keyExtractor={(t) => `${difficulty ?? 'all'}:${t.id}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.ink} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <TabHero greeting={greeting} title="Guide library" pose="wave" />

            <Segmented label="Guide type" options={KINDS} value={kind} onChange={setKind} />

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
              {!loading && !error && suits.size > 0 ? (
                <Chip
                  variant="filter"
                  icon="heart-outline"
                  label={`${suitsLabel} · ${suits.size}`}
                  active={suitsOnly}
                  onPress={() => setSuitsOnly((v) => !v)}
                />
              ) : null}
              {DIFFICULTY.slice(0, 1).map((d) => (
                <Chip
                  key={d.value}
                  variant="filter"
                  icon={d.icon}
                  label={d.label}
                  active={difficulty === d.value}
                  onPress={() => setDifficulty((cur) => (cur === d.value ? null : d.value))}
                />
              ))}
              <Chip variant="filter" icon="timer-outline" label="Under 30 min" active={quick} onPress={() => setQuick((v) => !v)} />
              {DIFFICULTY.slice(1).map((d) => (
                <Chip
                  key={d.value}
                  variant="filter"
                  icon={d.icon}
                  label={d.label}
                  active={difficulty === d.value}
                  onPress={() => setDifficulty((cur) => (cur === d.value ? null : d.value))}
                />
              ))}
              <Chip variant="filter" icon="cube-outline" label="Printable" active={printable} onPress={() => setPrintable((v) => !v)} />
            </ScrollView>

            {!loading && !error ? (
              <>
                <View style={styles.headingRow}>
                  <View style={styles.headingText}>
                    <Text style={styles.heading} accessibilityRole="header">
                      {heading}
                    </Text>
                    <Text style={styles.count}>
                      {visible.length} guide{visible.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setSortOpen((v) => !v)}
                    accessibilityRole="button"
                    accessibilityLabel={`Sort: ${sort.label}`}
                    accessibilityState={{ expanded: sortOpen }}
                    style={styles.sortPill}
                  >
                    <Ionicons name="swap-vertical" size={14} color={theme.colors.primaryDark} />
                    <Text style={styles.sortText}>{sort.words[asc ? 0 : 1]}</Text>
                    <Ionicons name="chevron-down" size={12} color={theme.colors.muted} />
                  </Pressable>
                  <Pressable
                    onPress={() => setAsc((v) => !v)}
                    accessibilityRole="button"
                    accessibilityLabel={`Switch to ${sort.words[asc ? 1 : 0].toLowerCase()} first`}
                    style={styles.sortFlip}
                  >
                    <Ionicons name={asc ? 'arrow-up' : 'arrow-down'} size={17} color={theme.colors.primaryDeep} />
                  </Pressable>
                </View>
                {sortOpen ? (
                  <View accessibilityRole="list" style={styles.sortMenu}>
                    {SORTS.map((s) => {
                      const on = s.key === sortKey
                      return (
                        <Pressable
                          key={s.key}
                          onPress={() => pickSort(s.key)}
                          accessibilityRole="button"
                          accessibilityLabel={s.label}
                          accessibilityState={{ selected: on }}
                          style={[styles.sortOption, on && styles.sortOptionOn]}
                        >
                          <View style={styles.headingText}>
                            <Text style={styles.sortOptionLabel}>{s.label}</Text>
                            <Text style={styles.sortOptionHint}>{s.hint}</Text>
                          </View>
                          {on ? <Ionicons name="checkmark" size={15} color={theme.colors.primaryDark} /> : null}
                        </Pressable>
                      )
                    })}
                  </View>
                ) : null}
              </>
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
          ) : (
            <EmptyState
              icon="search-outline"
              title="No tutorials here yet"
              hint={
                search
                  ? `Nothing matches "${search}". Try a different word, or clear the search.`
                  : 'Try removing a filter — new guides are added as contributors share them.'
              }
            />
          )
        }
        renderItem={({ item, index }) => {
          const org = backer(item)
          const pill = DIFF_PILL[item.difficulty]
          return (
            // Past the first screenful the stagger is invisible and only adds
            // latency, so the delay is capped rather than growing with the index.
            <Animated.View
              entering={FadeInDown.delay(Math.min(index, 7) * theme.motion.stagger).duration(theme.motion.base)}
            >
              <RowCard
                title={item.title}
                photo={item.toy_photo_url}
                icon={item.kind === 'assistive_tech' ? 'construct-outline' : 'cube-outline'}
                tint={TINTS[index % TINTS.length]}
                accessibilityHint={`${item.difficulty} difficulty. ${KIND_LABEL[item.kind]}. ${
                  org ? `Backed by ${org}` : 'Reviewed by SPLAT'
                }. Opens the tutorial.`}
                onPress={() => router.push({ pathname: '/guides/[id]', params: { id: item.id } })}
                pills={
                  <>
                    <Badge status={item.difficulty} icon={pill.icon} bg={pill.bg} />
                    {org ? <Badge status="approved" label="Backed" icon="checkmark-circle" bg={theme.colors.successSoft} /> : null}
                  </>
                }
                meta={
                  <View style={styles.metaRow}>
                    {item.build_minutes ? (
                      <MetaItem icon="time-outline">{formatBuildTime(item.build_minutes)}</MetaItem>
                    ) : null}
                    {item.thanks_count ? (
                      <MetaItem icon="heart" color={theme.colors.apricot}>
                        {String(item.thanks_count)}
                      </MetaItem>
                    ) : null}
                  </View>
                }
                aside={<SaveButton slug="tutorials" id={item.id} saves={saves} />}
              />
            </Animated.View>
          )
        }}
      />
      <CornerMenu
        label="Guide actions"
        items={[
          { label: 'Add a guide', icon: 'add', href: '/guides/new', primary: true },
          { label: 'My guides', icon: 'book-outline', href: '/tutorials' },
          { label: 'Saved guides', icon: 'heart-outline', href: '/saved/tutorials' },
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
  // Bleeds to the screen edge like the board's chip row, so a clipped chip
  // says "scroll me" rather than looking cut off by the gutter.
  chipScroller: { marginHorizontal: -theme.spacing(4) },
  chipRow: { gap: theme.spacing(2), paddingHorizontal: theme.spacing(4), paddingVertical: 4 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headingText: { flex: 1 },
  heading: { fontFamily: theme.fonts.display, fontSize: 20, lineHeight: 26, color: theme.colors.ink },
  count: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.muted },
  sortPill: {
    minHeight: 40,
    paddingHorizontal: theme.spacing(3),
    borderRadius: theme.radii.pill,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    ...theme.shadow(1),
  },
  sortText: { fontFamily: theme.fonts.black, fontSize: theme.type.caption, color: theme.colors.ink },
  sortFlip: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.pill,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow(1),
  },
  sortMenu: {
    padding: 6,
    gap: 2,
    marginTop: -theme.spacing(2),
    borderRadius: theme.radii.panel,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    ...theme.shadow(3),
  },
  sortOption: {
    minHeight: 46,
    paddingHorizontal: theme.spacing(3),
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sortOptionOn: { backgroundColor: theme.colors.accentFaint },
  sortOptionLabel: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  sortOptionHint: { fontFamily: theme.fonts.semiBold, fontSize: 11.5, color: theme.colors.muted },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2), flexWrap: 'wrap' },
  retry: { marginTop: theme.spacing(5), alignSelf: 'center', paddingHorizontal: theme.spacing(8) },
  // Clears the grid disc pinned bottom-right.
  listContent: { paddingBottom: theme.spacing(20) },
})
