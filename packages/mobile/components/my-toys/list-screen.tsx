// packages/mobile/components/my-toys/list-screen.tsx
import { useCallback, useEffect, useState } from 'react'
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import type { GivenAwayToy, OfferType, Toy, ToyTransactionSummary } from '@splat-connect/types'
import { givenAway, isOwnerSide } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { useCapabilities } from '../../lib/capabilities'
import { Screen } from '../ui/Screen'
import { Button } from '../ui/Button'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { ListIntro, ListRow, ListSection, Pill, RowThumb, StageFilter, StageNone, StagePill } from '../list/list-kit'
import { stageOptions, toyStage, type StageOption } from '../list/stage'

function offerLine(offerType: OfferType | null): string {
  if (offerType === 'donation') return 'Offered as Donation'
  if (offerType === 'exchange') return 'Offered as Exchange'
  if (offerType === 'both') return 'Offered as Donation or exchange'
  return 'Not offered yet'
}

// Owner-side requests still open, grouped by toy — the same isOwnerSide check
// the API and web's exchange thread use, so a leader's org toys count too
// wherever this list grows to include them.
//
// Deliberately NOT excluding blocked_by_rival_accept requests, unlike
// needsAction's badge count: those are still counted here on purpose. A
// blocked request is only cleared when the owner declines it, so leaving it
// out of this chip would hide work still waiting on them, even though
// needsAction is right to exclude it from ITS count (the rival that blocked
// it is the one real obligation, and counting both would double it).
function waitingCounts(
  transactions: ToyTransactionSummary[],
  viewerId: string,
  ledOrgIds: readonly string[]
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const tx of transactions) {
    if (tx.status !== 'requested') continue
    if (!isOwnerSide(tx, viewerId, ledOrgIds)) continue
    // A build has no toy row (057), so it has no card here to badge.
    if (!tx.toy_id) continue
    counts.set(tx.toy_id, (counts.get(tx.toy_id) ?? 0) + 1)
  }
  return counts
}

function ToyRow({
  item,
  waiting,
  onPress,
}: {
  item: Toy
  waiting: number
  onPress: () => void
}) {
  const line = offerLine(item.offer_type)
  const asked = waiting > 0 ? ` · ${waiting} request${waiting === 1 ? '' : 's'} waiting` : ''
  return (
    <ListRow
      title={item.name}
      meta={`${item.condition}/10 · ${line}${asked}`}
      thumb={<RowThumb photo={item.cover_photo_url} />}
      pill={
        <>
          <StagePill stage={toyStage(item.status, waiting)} />
          {item.switch_adapted ? <Pill label="Switch-adapted" bg={theme.colors.accentLight} icon="flash-outline" /> : null}
        </>
      }
      onPress={onPress}
      accessibilityHint={`Condition ${item.condition} of 10. ${line}. Status ${item.status}.${
        waiting > 0 ? ` ${waiting} request${waiting === 1 ? '' : 's'} waiting.` : ''
      } Opens the toy.`}
    />
  )
}

/**
 * A toy that is not on this shelf any more. It cannot come from /api/toys —
 * the row belongs to whoever received it now — so it is read back off the
 * completed handoff. Tapping opens that handoff, which is the only remaining
 * record of the meeting.
 */
function GivenAwayRow({ row, onPress }: { row: GivenAwayToy; onPress: () => void }) {
  const line = row.received_name
    ? `Swapped with ${row.other_party_name} for ${row.received_name}`
    : `Donated to ${row.other_party_name}`

  return (
    <View style={styles.rowWrap}>
      <ListRow
        title={row.name}
        titleLines={1}
        meta={`${line} · ${handoffDate(row.at)}`}
        thumb={<RowThumb photo={row.cover_photo_url} />}
        pill={<StagePill stage="gone" />}
        onPress={onPress}
        accessibilityHint={`${line}. Opens the exchange.`}
        dim
      />
    </View>
  )
}

function handoffDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function MyToysListScreen() {
  const router = useRouter()
  const { caps } = useCapabilities()
  const [toys, setToys] = useState<Toy[]>([])
  const [transactions, setTransactions] = useState<ToyTransactionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Bumping this re-runs the fetch — the retry button's handle, same as
  // my-tutorials/list-screen.tsx's reloadKey.
  const [reloadKey, setReloadKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [stage, setStage] = useState<StageOption['id']>('all')

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
    Promise.all([
      apiClient.get<Toy[]>('/api/toys'),
      apiClient.get<ToyTransactionSummary[]>('/api/toy-transactions'),
    ])
      .then(([t, tx]) => {
        if (!ignore) {
          setToys(t)
          setTransactions(tx)
        }
      })
      .catch((err) => {
        console.error('[MyToysListScreen] toy fetch failed:', err)
        if (!ignore) setError("Couldn't load your toys.")
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

  // Refetch every time this screen regains focus — a toy added or handed off
  // elsewhere otherwise shows stale until the app is backgrounded and reopened.
  useFocusEffect(
    useCallback(() => {
      setReloadKey((k) => k + 1)
    }, [])
  )

  const counts = caps
    ? waitingCounts(transactions, caps.profile.id, caps.ledOrgs.map((o) => o.id))
    : new Map<string, number>()
  const stageOf = (t: Toy) => toyStage(t.status, counts.get(t.id) ?? 0)
  const options = stageOptions(toys, stageOf, ['needsyou', 'live', 'hidden'])
  const activeToys = stage === 'all' ? toys : toys.filter((t) => stageOf(t) === stage)
  const gone = caps ? givenAway(transactions, caps.profile.id, caps.ledOrgs.map((o) => o.id)) : []

  const goToToy = (id: string) => router.push({ pathname: '/toys/[id]', params: { id } })

  const givenAwaySection =
    gone.length > 0 ? (
      <View style={styles.goneSection}>
        <ListSection>Given away</ListSection>
        {gone.map((row) => (
          <GivenAwayRow
            key={row.transaction_id}
            row={row}
            onPress={() => router.push(`/exchanges/${row.transaction_id}`)}
          />
        ))}
      </View>
    ) : null

  return (
    <Screen>
      {/*
        No ScreenHeader here — the native stack header already carries "My
        toys" (app/(my)/_layout.tsx) and is also the only way back to the My
        SPLAT hub.
      */}
      <ListIntro
        lead="The adapted toys you hold, ready to offer for exchange with an association."
        cta="+ Add a toy"
        onCta={() => router.push('/toys/new')}
      />

      {loading ? (
        <View>
          <SkeletonRow />
          <SkeletonRow />
        </View>
      ) : error ? (
        <EmptyState icon="cloud-offline-outline" title="Couldn't load your toys." hint="Check your connection and try again.">
          <Button
            label="Try again"
            variant="secondary"
            onPress={() => setReloadKey((k) => k + 1)}
            style={styles.retry}
          />
        </EmptyState>
      ) : toys.length === 0 && gone.length === 0 ? (
        <EmptyState
          icon="cube-outline"
          title="No toys yet"
          hint="Add your first toy — a name and its condition are all it takes to begin."
        >
          <Button
            label="+ Add a toy"
            variant="accent"
            onPress={() => router.push('/toys/new')}
            style={styles.retry}
          />
        </EmptyState>
      ) : (
        <FlatList
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.ink} />
          }
          data={activeToys}
          keyExtractor={(t) => t.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.rowWrap}>
              <ToyRow item={item} waiting={counts.get(item.id) ?? 0} onPress={() => goToToy(item.id)} />
            </View>
          )}
          ListHeaderComponent={
            toys.length > 0 ? (
              <StageFilter label="Filter toys by status" options={options} current={stage} onPick={setStage} />
            ) : null
          }
          // Someone who hands over their only toy still has a record of it.
          ListEmptyComponent={
            toys.length > 0 ? (
              <StageNone onClear={() => setStage('all')} />
            ) : (
              <Text style={styles.noneLeft}>No toys on your shelf right now.</Text>
            )
          }
          ListFooterComponent={givenAwaySection}
        />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  retry: { marginTop: theme.spacing(5), alignSelf: 'center', paddingHorizontal: theme.spacing(8) },
  listContent: { paddingBottom: theme.spacing(6) },
  noneLeft: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    marginBottom: theme.spacing(4),
  },
  goneSection: { marginTop: theme.spacing(4) },
  rowWrap: { marginBottom: theme.spacing(3) },
})
