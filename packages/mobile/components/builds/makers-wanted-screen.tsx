// packages/mobile/components/builds/makers-wanted-screen.tsx
/**
 * Makers wanted: build requests nobody has claimed. The mobile half of web's
 * components/makers-wanted-board.tsx, laid out as the board's #makers_wanted.
 *
 * "I'll build this" is a claim, not a message — one tap and the request becomes
 * a build thread with this maker on the other end. The board is a different
 * way IN to the same record, not a second kind of record.
 *
 * Live and Done read GET /builds-board as their tab is picked. Ask first opens
 * a private thread with the family (111) without claiming.
 *
 * Distance is measured from the maker's profile postcode to the family's (099);
 * without one, the chips ask for it.
 */
import { logFailure } from '../../lib/log'
import { useCallback, useRef, useState } from 'react'
import { View, Text, ScrollView, Pressable, RefreshControl, StyleSheet } from 'react-native'
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { Difficulty } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { useCapabilities } from '../../lib/capabilities'
import { nearParam } from '../../lib/near'
import { theme } from '../../lib/theme'
import { relativeTime } from '../../lib/notifications'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Chip } from '../ui/Chip'
import { Segmented } from '../ui/Segmented'
import { Button } from '../ui/Button'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { AnimatedPressable } from '../ui/AnimatedPressable'
import { ErrorRow } from '../ui/ErrorRow'
import { headerRightSlot } from '../../lib/nav-options'
import { apiMessage, buildRowMeta } from '@splat-connect/types'

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
  /** 099. Whole km from the maker's postcode; null when either is unknown. */
  km: number | null
  tutorial: {
    id: string
    title: string
    difficulty: Difficulty | null
    status: string
    build_minutes: number | null
    parts_total_cents: number | null
  } | null
}

/** GET /api/toy-transactions/builds-board, one row. A Done row carries only the guide, maker and date. */
type BoardBuild = OpenBuild & { maker_name: string; party: boolean; updated_at: string }

type Tab = 'open' | 'live' | 'done' | 'mine'
const BOARD_PAGE = 20
// The board's four tabs; counts on the first and last only (MB mwTabs). "Open"
// rather than web's "Needs a maker": four tabs plus counts do not fit 390pt.
const TABS: [Tab, string, boolean][] = [
  ['open', 'Open', true],
  ['live', 'Live', false],
  ['done', 'Done', false],
  ['mine', 'Yours', true],
]

// 0 is "Anywhere", last as on the board. Web's ranges, so a family and a
// maker read one scale.
const RANGES = [5, 10, 25, 0] as const

const DIFF_LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }

export function MakersWantedScreen() {
  const router = useRouter()
  const { caps, loading: capsLoading } = useCapabilities()
  const postcode = nearParam(caps?.profile.pickup_postcode)
  const params = useLocalSearchParams<{ tab?: string }>()
  const [tab, setTab] = useState<Tab>(params.tab === 'mine' ? 'mine' : 'open')
  const [range, setRange] = useState<number>(0)
  const [builds, setBuilds] = useState<OpenBuild[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [board, setBoard] = useState<BoardBuild[]>([])
  const [boardPage, setBoardPage] = useState(0)
  const [boardMore, setBoardMore] = useState(false)

  // Every board read takes a ticket; only the newest may land, so a slow Live
  // answer cannot fill the Done tab after the maker has moved on.
  const boardTicket = useRef(0)
  const loadBoard = useCallback(async (t: 'live' | 'done', page: number) => {
    const ticket = ++boardTicket.current
    try {
      const rows = await apiClient.get<BoardBuild[]>(`/api/toy-transactions/builds-board?tab=${t}&page=${page}`)
      if (ticket !== boardTicket.current) return
      setBoard((cur) => (page === 0 ? rows : [...cur, ...rows]))
      setBoardPage(page)
      setBoardMore(rows.length === BOARD_PAGE)
      setLoadFailed(false)
    } catch (err) {
      logFailure('[MakersWantedScreen] builds-board fetch failed:', err)
      if (ticket === boardTicket.current) setLoadFailed(true)
    }
  }, [])

  function pick(t: Tab) {
    setTab(t)
    setLoadFailed(false)
    boardTicket.current++
    if (t === 'live' || t === 'done') {
      setBoard([])
      void loadBoard(t, 0)
    }
  }

  const load = useCallback(async () => {
    try {
      setBuilds(
        await apiClient.get<OpenBuild[]>(
          postcode ? `/api/toy-transactions/open-builds?near=${encodeURIComponent(postcode)}` : '/api/toy-transactions/open-builds'
        )
      )
      setLoadFailed(false)
    } catch (err) {
      logFailure('[MakersWantedScreen] open-builds fetch failed:', err)
      setLoadFailed(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [postcode])

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
  const onBoard = tab === 'live' || tab === 'done'
  const inTab: (OpenBuild | BoardBuild)[] = onBoard ? board : builds.filter((b) => (tab === 'mine' ? b.mine : !b.mine))
  // Distance filters the open requests only (F8): Live and Done carry no km.
  const shown = range === 0 || onBoard ? inTab : inTab.filter((b) => b.km != null && b.km <= range)

  return (
    <Screen>
      <Stack.Screen
        options={{
          ...headerRightSlot(() => (
            <Pressable
              onPress={() => router.push('/explore/makers-wanted/new')}
              accessibilityRole="button"
              accessibilityLabel="Ask for a build"
              hitSlop={8}
              style={styles.addButton}
            >
              <Ionicons name="add" size={24} color={theme.colors.onColor} />
            </Pressable>
          )),
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

        <Segmented<Tab>
          label="Filter build requests"
          value={tab}
          onChange={pick}
          options={TABS.map(([value, label, counted]) => ({ value, label, badge: counted ? count(value) : undefined }))}
        />

        {capsLoading ? null : postcode ? (
          <View style={styles.ranges}>
            {/* The board's one word, so the chips fit on one row. */}
            <Text style={styles.rangeLabel}>Within</Text>
            {RANGES.map((km) => (
              <Chip key={km} label={km === 0 ? 'Anywhere' : `${km} km`} active={range === km} onPress={() => setRange(km)} />
            ))}
          </View>
        ) : (
          <View style={styles.ranges}>
            <Chip label="Add your postcode" icon="location-outline" active={false} onPress={() => router.push('/account')} />
          </View>
        )}

        <ErrorRow message={error} />

        {loading ? (
          <View>
            <SkeletonRow />
            <SkeletonRow />
          </View>
        ) : loadFailed && (onBoard ? board.length === 0 : builds.length === 0) ? (
          <EmptyState icon="cloud-offline-outline" title="Couldn't load the board." hint="Check your connection and try again.">
            <Button
              label="Try again"
              variant="secondary"
              onPress={() => (tab === 'live' || tab === 'done' ? void loadBoard(tab, 0) : void load())}
              style={styles.retry}
            />
          </EmptyState>
        ) : shown.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {tab === 'mine' ? 'You have not asked for a build yet' : 'Nothing at that stage'}
            </Text>
            {onBoard ? null : (
              <Text style={styles.emptyBody}>
                {tab === 'mine'
                  ? 'Tap + to pick a guide and ask a maker nearby. It shows up here and in My exchanges.'
                  : builds.length === 0
                    ? 'Open requests show up here as families post them.'
                    : 'No family in that range at the moment. Try Any distance.'}
              </Text>
            )}
          </View>
        ) : (
          <View style={styles.list}>
            {shown.map((b) => (
              <BuildCard
                key={b.id}
                b={b}
                kind={onBoard ? tab : 'open'}
                busy={busy === b.id}
                onClaim={() => claim(b.id)}
                onAsk={() => router.push(`/exchanges/build/ask/${b.id}`)}
                onTrack={() => router.push(`/exchanges/build/${b.id}`)}
              />
            ))}
          </View>
        )}
        {onBoard && boardMore ? (
          <Button
            label="Show more builds"
            variant="secondary"
            onPress={() => void loadBoard(tab, boardPage + 1)}
            style={styles.retry}
          />
        ) : null}

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
  kind,
  busy,
  onClaim,
  onAsk,
  onTrack,
}: {
  b: OpenBuild & Partial<Pick<BoardBuild, 'maker_name' | 'party' | 'updated_at'>>
  kind: 'open' | 'live' | 'done'
  busy: boolean
  onClaim: () => void
  onAsk: () => void
  onTrack: () => void
}) {
  const diff = b.tutorial?.difficulty ?? null
  const meta = b.tutorial ? buildRowMeta(b.tutorial) : null
  // The board's T: status pill and footer per stage.
  const stage =
    kind === 'live'
      ? { tint: theme.colors.honeySoft, icon: 'hammer' as const, label: 'Live', foot: b.party && !b.mine ? 'You are building it' : `${b.maker_name} is building it` }
      : kind === 'done'
        ? { tint: theme.colors.mintSoft, icon: 'checkmark-circle' as const, label: 'Handed over', foot: `Built by ${b.maker_name}` }
        : b.mine
          ? { tint: theme.colors.apricotSoft, icon: 'hourglass' as const, label: 'Waiting for a maker', foot: `Visible to makers within ${b.travel_km} km` }
          : { tint: theme.colors.mintSoft, icon: 'hand-left' as const, label: 'Open', foot: 'Unclaimed' }
  return (
    <Card style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.statusPill, { backgroundColor: stage.tint }]}>
          <Ionicons name={stage.icon} size={11} color={theme.colors.ink} />
          <Text style={styles.pillText}>{stage.label}</Text>
        </View>
        {/* A Done row has no suburb (F19); its time is the hand-over. */}
        <Text style={styles.where} numberOfLines={1}>
          {b.requester_suburb ? (
            <>
              <Ionicons name="location-outline" size={12} color={theme.colors.muted} /> {b.requester_suburb} ·{' '}
            </>
          ) : null}
          {relativeTime(kind === 'done' && b.updated_at ? b.updated_at : b.created_at)}
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
            {meta ? <Text style={[styles.pill, { backgroundColor: theme.colors.surfaceSunken }]}>{meta}</Text> : null}
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
        {b.km != null ? <Fact icon="navigate-outline" text={`${b.km} km away`} /> : null}
        {b.child_label ? <Fact icon="happy-outline" text={b.child_label} /> : null}
        {b.travel_km !== null ? <Fact icon="car-outline" text={`${b.travel_km} km`} /> : null}
        {b.urgency ? <Fact icon="calendar-outline" text={b.urgency} /> : null}
      </View>

      <View style={styles.foot}>
        <Text style={styles.footText} numberOfLines={2}>
          {stage.foot}
        </Text>
        {kind === 'live' ? (
          b.party ? <Button label="Thread" variant="secondary" onPress={onTrack} style={styles.footButton} /> : null
        ) : kind === 'done' ? null : b.mine ? (
          <Button label="Track" variant="secondary" onPress={onTrack} style={styles.footButton} />
        ) : (
          <>
            <Button label="Ask first" variant="ghost" onPress={onAsk} style={styles.footButton} />
            <Button
              label={busy ? 'Claiming…' : "I'll build this"}
              disabled={busy}
              onPress={onClaim}
              style={styles.footButton}
            />
          </>
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
  emptyTitle: { fontFamily: theme.fonts.display, fontSize: theme.type.body, color: theme.colors.text, textAlign: 'center' },
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
  pillText: { fontFamily: theme.fonts.black, fontSize: theme.type.micro, color: theme.colors.ink },
  where: { flexShrink: 1, fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.muted },
  guideRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3) },
  tile: { width: 52, height: 52, borderRadius: theme.radii.field, alignItems: 'center', justifyContent: 'center' },
  guideBody: { flex: 1, minWidth: 0 },
  guideTitle: { fontFamily: theme.fonts.display, fontSize: theme.type.body, color: theme.colors.text, lineHeight: 20 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(1.5), marginTop: theme.spacing(1) },
  pill: {
    fontFamily: theme.fonts.black,
    fontSize: theme.type.micro,
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
  factText: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.muted },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(2),
    borderTopWidth: theme.border.hairline,
    borderTopColor: theme.colors.border,
  },
  footText: { flex: 1, fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.muted },
  footButton: { paddingHorizontal: theme.spacing(4), minHeight: 44 },
  moneyNote: {
    padding: theme.spacing(4),
    borderRadius: theme.radii.card,
    backgroundColor: theme.colors.honeySoft,
  },
  moneyKicker: {
    fontFamily: theme.fonts.black,
    fontSize: theme.type.micro,
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
