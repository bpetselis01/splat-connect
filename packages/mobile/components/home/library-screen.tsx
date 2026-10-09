// packages/mobile/components/home/library-screen.tsx
//
// The Guides tab (spec 2026-10-05-library-redesign): a hero (title, one line,
// mascot), search with one filter button that opens the full filter page, the
// chosen filters as removable tags, then the heading and row cards.
import { logFailure } from '../../lib/log'
import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeInDown } from 'react-native-reanimated'
import type { Tutorial, TutorialOrg, Difficulty } from '@splat-connect/types'
import { KIND_LABEL, formatBuildTime } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { theme } from '../../lib/theme'
import { tabBarClearance } from '../../lib/tab-bar-layout'
import { scrollFrame, scrollContent, SEARCH_GAP } from '../../lib/layout'
import { useSaves } from '../../lib/saves'
import { useMyChildren } from '../../lib/my-children'
import { GUIDE_DEFAULTS, guideGroups, guideMatches, sortGuides, withChildSuggestion, type GuideSort } from '../../lib/library-filters'
import { TextField } from '../ui/TextField'
import { FilterButton } from '../ui/FilterControls'
import { FilterPage, FilterTagRow, filterTags, type FilterValues } from '../library/filter-page'
import { Screen } from '../ui/Screen'
import { Button } from '../ui/Button'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { Badge } from '../ui/Badge'
import { SaveButton } from '../ui/SaveButton'
import { CornerMenu } from '../ui/CornerMenu'
import { TabHero } from '../ui/TabHero'
import { RowCard, MetaItem } from '../ui/RowCard'

type IconName = React.ComponentProps<typeof Ionicons>['name']

const DIFF_PILL: Record<Difficulty, { icon: IconName; bg: string }> = {
  easy: { icon: 'happy', bg: theme.colors.successSoft },
  medium: { icon: 'contrast', bg: theme.colors.honeySoft },
  hard: { icon: 'flame', bg: theme.colors.apricotSoft },
}
// The tile when a guide has no photo: the board's duotone glyph on a rotating
// tint, so a page of photo-less guides is not one grey block.
const TINTS = [
  theme.colors.violetSoft,
  theme.colors.accentLight,
  theme.colors.mintSoft,
  theme.colors.honeySoft,
  theme.colors.apricotSoft,
]

/** The public list embeds only accepted backings on each row, and each guide's part names. */
type ListedTutorial = Tutorial & { tutorial_orgs?: TutorialOrg[]; parts?: { name: string }[] }

function backer(t: ListedTutorial): string | null {
  const accepted = (t.tutorial_orgs ?? []).find((o) => o.status === 'accepted')
  return accepted ? (accepted.organizations?.name ?? 'an organisation') : null
}

const SORT_WORD: Record<GuideSort, string> = { recommended: 'Recommended', new: 'Newest first', quick: 'Quickest first', easy: 'Easiest first' }

export function LibraryScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const saves = useSaves()
  const [tutorials, setTutorials] = useState<ListedTutorial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>(GUIDE_DEFAULTS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  // Recommended (128) sorts by the first child's answers; the filter page's
  // "About <name>" section opens with them as a suggestion.
  const children = useMyChildren()
  const child = children[0] ?? null
  const { printWith } = useLocalSearchParams<{ printWith?: string }>()
  // Bumping this re-runs the fetch — the retry button's and pull-to-refresh's
  // shared handle.
  const [reloadKey, setReloadKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = () => {
    setRefreshing(true)
    setReloadKey((k) => k + 1)
  }

  // The thanks pill counts what people said on the guide's own page, so coming
  // back to the list refetches it — quietly, the rows stay up. The first focus
  // is the mount fetch's.
  const focusedOnce = useRef(false)
  const quiet = useRef(false)
  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current) {
        quiet.current = true
        setReloadKey((k) => k + 1)
      }
      focusedOnce.current = true
    }, [])
  )

  const clearFilters = () => {
    setSearch('')
    setFilters(GUIDE_DEFAULTS)
  }

  useEffect(() => {
    let ignore = false
    // A pull-driven reload keeps the current rows on screen; skeletons are
    // for arriving with nothing.
    if (!refreshing && !quiet.current) setLoading(true)
    quiet.current = false
    setError(null)
    apiClient
      .get<ListedTutorial[]>('/api/public/tutorials')
      .then((data) => {
        if (!ignore) setTutorials(data)
      })
      .catch((err) => {
        logFailure('[LibraryScreen] tutorial fetch failed:', err)
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
  }, [reloadKey])

  // The whole approved set is already loaded (the endpoint isn't paged), so this
  // client-side match is complete — it just has to look past the title.
  const q = search.trim().toLowerCase()
  const matching = (draft: FilterValues) =>
    tutorials.filter(
      (t) =>
        (!q ||
          t.title.toLowerCase().includes(q) ||
          (t.description?.toLowerCase().includes(q) ?? false) ||
          (t.parts ?? []).some((p) => p.name.toLowerCase().includes(q))) &&
        guideMatches(t, draft)
    )
  const visible = sortGuides(matching(filters), filters.sort as GuideSort, child)
  const groups = guideGroups(!!child)
  const tags = filterTags(groups, filters, GUIDE_DEFAULTS, ['sort'])
  const filtered = tags.length > 0 || !!q
  const heading = filtered ? 'Matching guides' : 'All guides'

  // One always-mounted list: header, search and filters live inside it as
  // ListHeaderComponent so they scroll away with the content. Loading/error/
  // empty render through ListEmptyComponent so the header holds across states.
  return (
    <Screen ownHeader>
      <FlatList
        data={loading || error ? [] : visible}
        // The filter is part of each row's key so a new difficulty replays the
        // rows' entrance without remounting the header.
        keyExtractor={(t) => t.id}
        showsVerticalScrollIndicator={false}
        style={scrollFrame}
        contentContainerStyle={[scrollContent, { paddingBottom: tabBarClearance(insets.bottom) }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.ink} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <TabHero title="Guide library" line="Step-by-step guides to adapt toys and build switches, with the parts to print." pose="wave" />

            <View style={styles.searchRow}>
              <View style={styles.flex}>
                <TextField
                  icon="search"
                  placeholder="Search guides"
                  value={search}
                  onChangeText={setSearch}
                  boxStyle={styles.searchBar}
                  search
                />
              </View>
              <FilterButton count={tags.length} onPress={() => setFiltersOpen(true)} />
            </View>

            <FilterTagRow tags={tags} value={filters} onChange={setFilters} />

            {!loading && !error ? (
              <View style={styles.headingRow}>
                <Text style={styles.heading} accessibilityRole="header">
                  {heading}
                </Text>
                <Text style={styles.count}>
                  {`${visible.length} guide${visible.length === 1 ? '' : 's'} · ${SORT_WORD[filters.sort as GuideSort]}`}
                </Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            // The board's caption sits under the skeletons, centred.
            <View accessibilityLabel="Loading guides">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <Text style={styles.loadingCaption}>Loading guides…</Text>
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
            >
              {filtered ? (
                <Button label="Clear filters" variant="secondary" onPress={clearFilters} style={styles.retry} />
              ) : null}
            </EmptyState>
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
                onPress={() => router.push({ pathname: '/guides/[id]', params: printWith ? { id: item.id, printWith } : { id: item.id } })}
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
      <FilterPage
        visible={filtersOpen}
        groups={groups}
        start={withChildSuggestion(filters, children[0])}
        defaults={GUIDE_DEFAULTS}
        count={(draft) => matching(draft).length}
        noun={['guide', 'guides']}
        onApply={(v) => {
          setFilters(v)
          setFiltersOpen(false)
        }}
        onClose={() => setFiltersOpen(false)}
      />
      <CornerMenu
        label="Guide actions"
        items={[
          { label: 'Add a guide', icon: 'add', href: '/guides/new', primary: true },
          { label: 'My guides', icon: 'book-outline', href: '/tutorials', tint: theme.colors.apricotSoft },
          { label: 'Saved guides', icon: 'heart-outline', href: '/saved/tutorials', tint: theme.colors.mintSoft },
          { label: 'Request a print', icon: 'print-outline', href: '/printing', tint: theme.colors.honeySoft },
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
    minHeight: 52,
    ...theme.shadow(1),
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  flex: { flex: 1 },
  headingRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 },
  heading: { fontFamily: theme.fonts.display, fontSize: theme.type.heading, lineHeight: 26, color: theme.colors.ink },
  count: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.muted },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2), flexWrap: 'wrap' },
  loadingCaption: {
    marginTop: theme.spacing(1),
    textAlign: 'center',
    fontFamily: theme.fonts.semiBold,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
  },
  retry: { marginTop: theme.spacing(5), alignSelf: 'center', paddingHorizontal: theme.spacing(8) },
})
