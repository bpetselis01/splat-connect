// packages/mobile/components/exchanges/list-screen.tsx
import { useCallback, useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet } from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import type { ToyTransactionSummary, ToyTransactionStatus } from '@splat-connect/types'
import { needsAction, actionLabel } from '@splat-connect/types'
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

// Same rule as web's dashboard/exchanges/page.tsx: a request not yet answered
// and an acceptance nobody has confirmed can still change. Everything else is
// settled and belongs in History.
const ACTIVE: ToyTransactionStatus[] = ['requested', 'accepted']

function TransactionRow({
  tx,
  viewerId,
  ledOrgIds,
  onPress,
}: {
  tx: ToyTransactionSummary
  viewerId: string
  ledOrgIds: string[]
  onPress: () => void
}) {
  const acting = needsAction(tx, viewerId, ledOrgIds)
  const typeLabel = tx.type === 'donation' ? 'Donation' : 'Exchange'
  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${tx.toy_name} with ${tx.other_party_name}`}
      accessibilityHint={`Status ${tx.status}.${acting ? ` ${actionLabel(tx)}.` : ''} Opens the exchange thread.`}
      pressScale={0.985}
    >
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.titleBlock}>
            <Text style={styles.toyName} numberOfLines={1}>
              {tx.toy_name}
              {tx.offered_toy_name ? ` ⇄ ${tx.offered_toy_name}` : ''}
            </Text>
            <Text style={styles.metaLine} numberOfLines={1}>
              {typeLabel} with {tx.other_party_name}
            </Text>
            {/* A leader's own toys and their organisation's arrive in one
                list, and nothing else tells them apart — which hat they are
                answering as changes whose toy this is. Same cue as web's
                dashboard/exchanges/page.tsx TransactionRow. */}
            {tx.acting_for_org_name ? (
              <Text style={styles.orgLine} numberOfLines={1}>
                On behalf of {tx.acting_for_org_name}
              </Text>
            ) : null}
          </View>
          <Badge status={tx.status} />
        </View>

        {/* The one line on this card that is an instruction rather than a
            fact, so it is the one line the eye lands on — same treatment as
            web's mint note, apricot here to match the rest of the app. */}
        {acting ? (
          <View style={styles.actionBox}>
            <Text style={styles.actionText}>{actionLabel(tx)}</Text>
          </View>
        ) : null}

        {tx.blocked_by_rival_accept ? (
          <Text style={styles.mutedLine}>Locked — another request accepted</Text>
        ) : null}

        {tx.last_message ? (
          <Text style={styles.lastMessage} numberOfLines={1}>
            {tx.last_message.sender_id === viewerId && tx.last_message.kind === 'user' ? 'You: ' : ''}
            {tx.last_message.body}
          </Text>
        ) : null}
      </Card>
    </AnimatedPressable>
  )
}

export function ExchangesListScreen() {
  const router = useRouter()
  const { toy: filterToyId } = useLocalSearchParams<{ toy?: string }>()
  const { caps } = useCapabilities()
  const [transactions, setTransactions] = useState<ToyTransactionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Bumping this re-runs the fetch — the retry button's handle, same as
  // my-toys/list-screen.tsx's reloadKey.
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError(null)
    apiClient
      .get<ToyTransactionSummary[]>('/api/toy-transactions')
      .then((data) => {
        if (!ignore) setTransactions(data)
      })
      .catch((err) => {
        console.error('[ExchangesListScreen] transaction fetch failed:', err)
        if (!ignore) setError("Couldn't load your exchanges.")
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [reloadKey])

  // Refetch every time this screen regains focus — a request answered or a
  // handoff confirmed elsewhere otherwise shows stale until the app is
  // backgrounded and reopened.
  useFocusEffect(
    useCallback(() => {
      setReloadKey((k) => k + 1)
    }, [])
  )

  const viewerId = caps?.profile.id ?? ''
  const ledOrgIds = caps?.ledOrgs.map((o) => o.id) ?? []

  // ?toy= arrives from the toy editor's offers row (Task 5) — narrow to the
  // requests on that one toy. Named off the unfiltered list, so the chip
  // still reads correctly even if every matching row happens to be settled.
  const filterToyName = filterToyId
    ? transactions.find((t) => t.toy_id === filterToyId)?.toy_name
    : undefined
  const filtered = filterToyId ? transactions.filter((t) => t.toy_id === filterToyId) : transactions
  const active = filtered.filter((t) => ACTIVE.includes(t.status))
  const history = filtered.filter((t) => !ACTIVE.includes(t.status))

  const goToThread = (id: string) => router.push(`/exchanges/${id}`)
  // undefined clears a param under React Navigation's setParams (which expo
  // Router's router.setParams delegates straight to) rather than merely
  // stringifying to "undefined" — verified against
  // node_modules/expo-router/build/global-state/router.js.
  const clearFilter = () => router.setParams({ toy: undefined })

  const renderRow = (item: ToyTransactionSummary) => (
    <View key={item.id} style={styles.rowWrap}>
      <TransactionRow tx={item} viewerId={viewerId} ledOrgIds={ledOrgIds} onPress={() => goToThread(item.id)} />
    </View>
  )

  return (
    <Screen>
      {/*
        No ScreenHeader here — the native stack header already carries "My
        exchanges" (app/(my)/_layout.tsx) and is also the only way back to
        the My SPLAT hub.
      */}
      <View style={styles.topRow}>
        {filterToyId ? (
          <AnimatedPressable
            onPress={clearFilter}
            accessibilityRole="button"
            accessibilityLabel={`Clear filter: offers on ${filterToyName ?? 'this toy'}`}
            style={styles.chip}
          >
            <Text style={styles.chipText}>Offers on {filterToyName ?? 'this toy'} ✕</Text>
          </AnimatedPressable>
        ) : (
          <Text style={styles.subtitle}>
            Toys you have asked for and toys people have asked you for.
          </Text>
        )}
      </View>

      {loading ? (
        <View>
          <SkeletonRow />
          <SkeletonRow />
        </View>
      ) : error ? (
        <EmptyState icon="cloud-offline-outline" title="Couldn't load your exchanges." hint="Check your connection and try again.">
          <Button label="Try again" variant="secondary" onPress={() => setReloadKey((k) => k + 1)} style={styles.retry} />
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="swap-horizontal-outline"
          title="No donation or exchange requests yet"
          hint="Ask for a toy from the library, or list one of yours, and the conversation starts here."
        >
          <Button
            label="Browse the toy library"
            variant="accent"
            onPress={() => router.push('/toy-library')}
            style={styles.retry}
          />
        </EmptyState>
      ) : (
        <FlatList
          data={active}
          keyExtractor={(t) => t.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={active.length > 0 ? <Text style={styles.sectionHeader}>Active</Text> : null}
          renderItem={({ item }) => renderRow(item)}
          ListFooterComponent={
            history.length > 0 ? (
              <View style={styles.historySection}>
                <Text style={styles.sectionHeader}>History</Text>
                {history.map(renderRow)}
              </View>
            ) : null
          }
        />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  topRow: { marginBottom: theme.spacing(4) },
  subtitle: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, lineHeight: 20 },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.accentLight,
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(2),
  },
  chipText: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.primaryDeep },
  retry: { marginTop: theme.spacing(5), alignSelf: 'center', paddingHorizontal: theme.spacing(8) },
  listContent: { paddingBottom: theme.spacing(6) },
  sectionHeader: { fontFamily: theme.fonts.bold, fontSize: theme.type.heading, color: theme.colors.text, marginBottom: theme.spacing(3) },
  historySection: { marginTop: theme.spacing(6) },
  rowWrap: { marginBottom: theme.spacing(3) },
  card: { padding: theme.spacing(3), gap: theme.spacing(2) },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing(2) },
  titleBlock: { flex: 1, gap: theme.spacing(1) },
  toyName: { fontFamily: theme.fonts.bold, color: theme.colors.text, fontSize: theme.type.label },
  metaLine: { fontFamily: theme.fonts.regular, color: theme.colors.muted, fontSize: theme.type.caption },
  orgLine: { fontFamily: theme.fonts.regular, color: theme.colors.muted, fontSize: theme.type.caption, marginTop: theme.spacing(1) },
  actionBox: {
    alignSelf: 'flex-start',
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.apricotSoft,
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(1),
  },
  actionText: { fontFamily: theme.fonts.bold, color: theme.colors.apricotDeep, fontSize: theme.type.caption },
  mutedLine: { fontFamily: theme.fonts.regular, color: theme.colors.muted, fontSize: theme.type.caption },
  lastMessage: {
    fontFamily: theme.fonts.regular,
    color: theme.colors.muted,
    fontSize: theme.type.caption,
    borderTopWidth: theme.border.thin,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing(2),
  },
})
