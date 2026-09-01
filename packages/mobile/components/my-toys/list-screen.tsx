// packages/mobile/components/my-toys/list-screen.tsx
import { useCallback, useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet, Image } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { GivenAwayToy, OfferType, Toy, ToyTransactionSummary } from '@splat-connect/types'
import { givenAway, isOwnerSide } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { useCapabilities } from '../../lib/capabilities'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { AnimatedPressable } from '../ui/AnimatedPressable'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { Meter } from '../ui/Meter'

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
  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.name}
      accessibilityHint={`Condition ${item.condition} of 10. ${line}. Status ${item.status}.${
        waiting > 0 ? ` ${waiting} request${waiting === 1 ? '' : 's'} waiting.` : ''
      } Opens the toy.`}
      pressScale={0.985}
    >
      <Card style={styles.card}>
        {item.cover_photo_url ? (
          <Image source={{ uri: item.cover_photo_url }} style={styles.thumbnail} />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Ionicons name="cube-outline" size={22} color={theme.colors.primary} />
          </View>
        )}
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.name}
          </Text>
          {/*
            Hidden from the accessibility tree, same as toy-library-screen's
            card: the meter and badges restate what the row's hint above
            already says, and doubling it up would double-announce.
          */}
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={styles.meterRow}>
              <Meter value={item.condition} />
              <Text style={styles.meterLine}>{`${item.condition}/10 · ${line}`}</Text>
            </View>
            <View style={styles.badgeRow}>
              <Badge status={item.status} />
              {item.switch_adapted ? <Badge status="switch_adapted" label="Switch-adapted" /> : null}
            </View>
          </View>
        </View>
        {/* The count itself is folded into the row's accessibilityHint above —
            the row's own accessible container swallows any label set here,
            so a label on this View would never reach a screen reader. */}
        {waiting > 0 ? (
          <View style={styles.waitingChip}>
            <Text style={styles.waitingText}>{waiting}</Text>
          </View>
        ) : null}
      </Card>
    </AnimatedPressable>
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
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={row.name}
      accessibilityHint={`${line}. Opens the exchange.`}
      pressScale={0.99}
      style={styles.rowWrap}
    >
      <Card style={[styles.card, styles.goneCard]}>
        {row.cover_photo_url ? (
          <Image source={{ uri: row.cover_photo_url }} style={styles.thumbnail} />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Ionicons name="cube-outline" size={22} color={theme.colors.primary} />
          </View>
        )}
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {row.name}
          </Text>
          {/* Hidden: the row's hint above already reads both lines out. */}
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Text style={styles.goneLine}>{line}</Text>
            <Text style={styles.goneDate}>{handoffDate(row.at)}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
      </Card>
    </AnimatedPressable>
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

  useEffect(() => {
    let ignore = false
    setLoading(true)
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
        if (!ignore) setLoading(false)
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
  const activeToys = toys
  const gone = caps ? givenAway(transactions, caps.profile.id, caps.ledOrgs.map((o) => o.id)) : []

  const goToToy = (id: string) => router.push({ pathname: '/toys/[id]', params: { id } })

  const givenAwaySection =
    gone.length > 0 ? (
      <View style={styles.goneSection}>
        <Text style={styles.goneHeading}>Given away</Text>
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
      <View style={styles.headerRow}>
        <Text style={styles.subtitle}>
          The adapted toys you hold, ready to offer for exchange with an association.
        </Text>
        <Button
          label="+ Add a toy"
          variant="accent"
          onPress={() => router.push('/toys/new')}
          style={styles.addToy}
        />
      </View>

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
          data={activeToys}
          keyExtractor={(t) => t.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.rowWrap}>
              <ToyRow item={item} waiting={counts.get(item.id) ?? 0} onPress={() => goToToy(item.id)} />
            </View>
          )}
          // Someone who hands over their only toy still has a record of it.
          ListEmptyComponent={<Text style={styles.noneLeft}>No toys on your shelf right now.</Text>}
          ListFooterComponent={givenAwaySection}
        />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing(2), marginBottom: theme.spacing(4) },
  subtitle: {
    flex: 1,
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    lineHeight: 20,
  },
  addToy: { paddingVertical: theme.spacing(2), paddingHorizontal: theme.spacing(3) },
  retry: { marginTop: theme.spacing(5), alignSelf: 'center', paddingHorizontal: theme.spacing(8) },
  listContent: { paddingBottom: theme.spacing(6) },
  noneLeft: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    marginBottom: theme.spacing(4),
  },
  goneSection: { marginTop: theme.spacing(4) },
  goneHeading: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.heading,
    color: theme.colors.text,
    marginBottom: theme.spacing(2),
  },
  // Receded, not hidden — the same 60% web's section takes.
  goneCard: { opacity: 0.6 },
  goneLine: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    lineHeight: 18,
  },
  goneDate: { fontFamily: theme.fonts.regular, fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  rowWrap: { marginBottom: theme.spacing(3) },
  card: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), padding: theme.spacing(3) },
  thumbnail: { width: 56, height: 56, borderRadius: theme.radii.sm, backgroundColor: theme.colors.surfaceSunken },
  thumbnailPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: theme.spacing(1) },
  cardTitle: { fontFamily: theme.fonts.bold, color: theme.colors.text, fontSize: theme.type.label },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2), marginTop: theme.spacing(1) },
  meterLine: { fontFamily: theme.fonts.regular, color: theme.colors.muted, fontSize: theme.type.caption },
  badgeRow: { flexDirection: 'row', gap: theme.spacing(2), marginTop: theme.spacing(2) },
  waitingChip: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: theme.spacing(2),
    borderRadius: theme.radii.pill,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    backgroundColor: theme.colors.apricot,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitingText: { fontFamily: theme.fonts.numeral, fontSize: 17, lineHeight: 18, color: theme.colors.ink },
})
