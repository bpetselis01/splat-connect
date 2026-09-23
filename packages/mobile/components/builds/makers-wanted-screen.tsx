// packages/mobile/components/builds/makers-wanted-screen.tsx
/**
 * Makers wanted: build requests nobody has claimed. The mobile half of web's
 * components/makers-wanted-board.tsx, laid out as the board's #makers_wanted.
 *
 * "I'll build this" is a claim, not a message — one tap and the request becomes
 * a build thread with this maker on the other end. The board is a different
 * way IN to the same record, not a second kind of record.
 *
 * What the board draws and this does not, both for web's reasons:
 * - Live and Done tabs. GET /open-builds carries unclaimed requests only, so
 *   only the two tabs it can fill are drawn.
 * - "Ask first". Messages belong to a transaction's two parties and an
 *   unclaimed request has one; a second button that also claimed would be
 *   worse than one honest one.
 * - Distance from the maker. SPLAT stores a suburb and how far the FAMILY can
 *   travel, never a point, so the filter is over their range, not "within".
 */
import { useCallback, useState } from 'react'
import { View, Text, ScrollView, Pressable, RefreshControl, StyleSheet } from 'react-native'
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { Difficulty } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { relativeTime } from '../../lib/notifications'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { AnimatedPressable } from '../ui/AnimatedPressable'
import { ErrorRow } from '../auth-screen'
import { apiMessage } from '../exchanges/thread-screen'

/** GET /api/toy-transactions/open-builds, one row. No requester name — by design. */
export type OpenBuild = {
  id: string
  tutorial_id: string
  build_brief: string | null
  travel_km: number | null
  urgency: string | null
  child_label: string | null
  requester_suburb: string | null
  family_has_toy: boolean
  created_at: string
  mine: boolean
  tutorial: { id: string; title: string; difficulty: Difficulty | null; status: string } | null
}

type Tab = 'open' | 'mine'

// 0 is "Any distance". Web's ranges, so a family and a maker read one scale.
const RANGES = [0, 5, 10, 25] as const

const DIFF_LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }

export function MakersWantedScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ tab?: string }>()
  const [tab, setTab] = useState<Tab>(params.tab === 'mine' ? 'mine' : 'open')
  const [range, setRange] = useState<number>(0)
  const [builds, setBuilds] = useState<OpenBuild[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setBuilds(await apiClient.get<OpenBuild[]>('/api/toy-transactions/open-builds'))
      setLoadFailed(false)
    } catch (err) {
      console.error('[MakersWantedScreen] open-builds fetch failed:', err)
      setLoadFailed(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Refetched on focus: coming back from the ask sheet or a claimed thread must
  // show the board as it now is, not as it was.
  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load])
  )

  async function claim(id: string) {
    setError(null)
    setBusy(id)
    try {
      await apiClient.post(`/api/toy-transactions/${id}/claim`, {})
      // Straight to the thread — the row is gone from this board now.
      router.push(`/exchanges/build/${id}`)
    } catch (err) {
      setError(apiMessage(err, 'That did not go through. Try once more.'))
      // A 409 means somebody else got there first; the board should say so.
      void load()
    } finally {
      setBusy(null)
    }
  }

  const count = (t: Tab) => builds.filter((b) => (t === 'mine' ? b.mine : !b.mine)).length
  const inTab = builds.filter((b) => (tab === 'mine' ? b.mine : !b.mine))
  const shown = range === 0 ? inTab : inTab.filter((b) => (b.travel_km ?? 0) >= range)

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/explore/makers-wanted/new')}
              accessibilityRole="button"
              accessibilityLabel="Ask for a build"
              hitSlop={8}
              style={styles.addButton}
            >
              <Ionicons name="add" size={24} color={theme.colors.surface} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              void load()
            }}
            tintColor={theme.colors.ink}
          />
        }
      >
        <Text style={styles.intro}>
          Families who found the right guide but cannot build it. Claim one, build it with the parts
          the family covers, and hand it over like any toy.
        </Text>

        <View accessibilityRole="tablist" accessibilityLabel="Filter build requests" style={styles.tabs}>
          {(
            [
              ['open', 'Needs a maker', theme.colors.mintSoft],
              ['mine', 'Yours', theme.colors.apricotSoft],
            ] as const
          ).map(([k, label, tint]) => {
            const on = tab === k
            const n = count(k)
            return (
              <Pressable
                key={k}
                onPress={() => setTab(k)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={[styles.tab, on && styles.tabOn]}
              >
                <Text style={styles.tabText}>{label}</Text>
                {n > 0 ? (
                  <Text style={[styles.tabCount, { backgroundColor: tint }]}>{n}</Text>
                ) : null}
              </Pressable>
            )
          })}
        </View>

        <View style={styles.ranges}>
          <Text style={styles.rangeLabel}>Families who can travel</Text>
          {RANGES.map((km) => (
            <Chip
              key={km}
              label={km === 0 ? 'Any distance' : `${km} km+`}
              active={range === km}
              onPress={() => setRange(km)}
            />
          ))}
        </View>

        <ErrorRow message={error} />

        {loading ? (
          <View>
            <SkeletonRow />
            <SkeletonRow />
          </View>
        ) : loadFailed && builds.length === 0 ? (
          <EmptyState icon="cloud-offline-outline" title="Couldn't load the board." hint="Check your connection and try again.">
            <Button label="Try again" variant="secondary" onPress={() => void load()} style={styles.retry} />
          </EmptyState>
        ) : shown.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {tab === 'mine' ? 'You have not asked for a build yet' : 'Nothing at that stage'}
            </Text>
            <Text style={styles.emptyBody}>
              {tab === 'mine'
                ? 'Tap + to pick a guide and ask a maker nearby. It shows up here and in My exchanges.'
                : builds.length === 0
                  ? 'Open requests show up here as families post them.'
                  : 'No family in that range at the moment. Try Any distance.'}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {shown.map((b) => (
              <BuildCard
                key={b.id}
                b={b}
                busy={busy === b.id}
                onClaim={() => claim(b.id)}
                onTrack={() => router.push(`/exchanges/build/${b.id}`)}
              />
            ))}
          </View>
        )}

        <View style={styles.moneyNote}>
          <Text style={styles.moneyKicker}>Parts and money</Text>
          <Text style={styles.moneyBody}>
            The family covers the parts — most guides are under $35. The maker gives the time and the
            skill and is never out of pocket. Sort the receipt out in the thread. Nothing else changes
            hands.
          </Text>
        </View>

        <AnimatedPressable
          onPress={() => router.push('/explore/challenges/new')}
          accessibilityRole="button"
          accessibilityLabel="No guide for what your child needs?"
          accessibilityHint="That is an idea, not a build request. Describe it for makers."
          pressScale={0.98}
          style={styles.ideaRow}
        >
          <Ionicons name="bulb-outline" size={26} color={theme.colors.primary} />
          <View style={styles.ideaBody}>
            <Text style={styles.ideaTitle}>No guide for what your child needs?</Text>
            <Text style={styles.ideaText}>That is an idea, not a build request. Describe it for makers.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.primaryDeep} />
        </AnimatedPressable>
      </ScrollView>
    </Screen>
  )
}

function BuildCard({
  b,
  busy,
  onClaim,
  onTrack,
}: {
  b: OpenBuild
  busy: boolean
  onClaim: () => void
  onTrack: () => void
}) {
  const diff = b.tutorial?.difficulty ?? null
  return (
    <Card style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.statusPill, { backgroundColor: b.mine ? theme.colors.apricotSoft : theme.colors.mintSoft }]}>
          <Ionicons name={b.mine ? 'hourglass' : 'hand-left'} size={11} color={theme.colors.ink} />
          <Text style={styles.pillText}>{b.mine ? 'Waiting for a maker' : 'Needs a maker'}</Text>
        </View>
        <Text style={styles.where} numberOfLines={1}>
          <Ionicons name="location-outline" size={12} color={theme.colors.muted} /> {b.requester_suburb} ·{' '}
          {relativeTime(b.created_at)}
        </Text>
      </View>

      <View style={styles.guideRow}>
        <View
          style={[styles.tile, { backgroundColor: diff ? theme.colors.difficulty[diff].bg : theme.colors.accentLight }]}
        >
          <Ionicons name="book-outline" size={26} color={theme.colors.ink} />
        </View>
        <View style={styles.guideBody}>
          {/* A guide can be unpublished after somebody asks for it. The request
              stays — the family still wants the thing. */}
          <Text style={styles.guideTitle}>{b.tutorial?.title ?? 'A guide that is no longer published'}</Text>
          <View style={styles.pills}>
            {diff ? (
              <Text style={[styles.pill, { backgroundColor: theme.colors.difficulty[diff].bg }]}>{DIFF_LABEL[diff]}</Text>
            ) : null}
            <Text style={[styles.pill, { backgroundColor: theme.colors.tone.mint.bg }]}>Family covers parts</Text>
            {b.family_has_toy ? (
              <Text style={[styles.pill, { backgroundColor: theme.colors.honeySoft }]}>Family has the toy</Text>
            ) : null}
          </View>
        </View>
      </View>

      {b.build_brief ? (
        <Text style={styles.brief}>
          <Text style={styles.briefWho}>{b.mine ? 'You' : `Family in ${b.requester_suburb}`}: </Text>
          “{b.build_brief}”
        </Text>
      ) : null}

      <View style={styles.facts}>
        {b.child_label ? <Fact icon="happy-outline" text={b.child_label} /> : null}
        {b.travel_km !== null ? <Fact icon="car-outline" text={`${b.travel_km} km`} /> : null}
        {b.urgency ? <Fact icon="calendar-outline" text={b.urgency} /> : null}
      </View>

      <View style={styles.foot}>
        <Text style={styles.footText} numberOfLines={2}>
          {b.mine ? `Visible to makers within ${b.travel_km} km` : 'Unclaimed'}
        </Text>
        {b.mine ? (
          <Button label="Track" variant="secondary" onPress={onTrack} style={styles.footButton} />
        ) : (
          <Button
            label={busy ? 'Claiming…' : "I'll build this"}
            disabled={busy}
            onPress={onClaim}
            style={styles.footButton}
          />
        )}
      </View>
    </Card>
  )
}

function Fact({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={13} color={theme.colors.muted} />
      <Text style={styles.factText}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing(6), gap: theme.spacing(3) },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow(2),
  },
  intro: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, lineHeight: 21 },
  tabs: {
    flexDirection: 'row',
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surfaceSunken,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: theme.radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
  },
  tabOn: { backgroundColor: theme.colors.surface, ...theme.shadow(1) },
  tabText: { fontFamily: theme.fonts.black, fontSize: theme.type.caption, color: theme.colors.ink },
  tabCount: {
    minWidth: 18,
    paddingHorizontal: 5,
    borderRadius: theme.radii.pill,
    overflow: 'hidden',
    textAlign: 'center',
    fontFamily: theme.fonts.black,
    fontSize: 11,
    lineHeight: 18,
    color: theme.colors.ink,
  },
  ranges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing(1.5) },
  rangeLabel: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.muted },
  retry: { marginTop: theme.spacing(5), alignSelf: 'center', paddingHorizontal: theme.spacing(8) },
  empty: {
    alignItems: 'center',
    padding: theme.spacing(8),
    borderRadius: theme.radii.card,
    borderWidth: theme.border.hairline,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  emptyTitle: { fontFamily: theme.fonts.display, fontSize: 17, color: theme.colors.text, textAlign: 'center' },
  emptyBody: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: theme.spacing(1.5),
  },
  list: { gap: theme.spacing(3) },
  card: { padding: theme.spacing(4), gap: theme.spacing(2.5) },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing(2) },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: theme.radii.pill,
  },
  pillText: { fontFamily: theme.fonts.black, fontSize: 11, color: theme.colors.ink },
  where: { flexShrink: 1, fontFamily: theme.fonts.semiBold, fontSize: 12, color: theme.colors.muted },
  guideRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3) },
  tile: { width: 52, height: 52, borderRadius: theme.radii.field, alignItems: 'center', justifyContent: 'center' },
  guideBody: { flex: 1, minWidth: 0 },
  guideTitle: { fontFamily: theme.fonts.display, fontSize: theme.type.body, color: theme.colors.text, lineHeight: 20 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(1.5), marginTop: theme.spacing(1) },
  pill: {
    fontFamily: theme.fonts.black,
    fontSize: 11,
    color: theme.colors.ink,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radii.pill,
    overflow: 'hidden',
  },
  brief: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    lineHeight: 19,
    padding: theme.spacing(2.5),
    borderRadius: theme.radii.field,
    backgroundColor: theme.colors.surfaceSunken,
    overflow: 'hidden',
  },
  briefWho: { fontFamily: theme.fonts.black, color: theme.colors.ink },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(3) },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  factText: { fontFamily: theme.fonts.bold, fontSize: 12, color: theme.colors.muted },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(2),
    borderTopWidth: theme.border.hairline,
    borderTopColor: theme.colors.border,
  },
  footText: { flex: 1, fontFamily: theme.fonts.bold, fontSize: 12, color: theme.colors.muted },
  footButton: { paddingHorizontal: theme.spacing(4), minHeight: 44 },
  moneyNote: {
    padding: theme.spacing(4),
    borderRadius: theme.radii.card,
    backgroundColor: theme.colors.honeySoft,
  },
  moneyKicker: {
    fontFamily: theme.fonts.black,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: theme.colors.ink,
    marginBottom: theme.spacing(1),
  },
  moneyBody: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.ink, lineHeight: 19 },
  ideaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
    padding: theme.spacing(4),
    borderRadius: theme.radii.card,
    backgroundColor: theme.colors.accentLight,
  },
  ideaBody: { flex: 1, gap: 3 },
  ideaTitle: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  ideaText: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.ink, lineHeight: 18 },
})
