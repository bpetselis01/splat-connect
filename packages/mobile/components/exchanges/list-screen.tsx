// packages/mobile/components/exchanges/list-screen.tsx
import { useCallback, useEffect, useState } from 'react'
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import type { ToyTransactionSummary, ToyTransactionStatus } from '@splat-connect/types'
import { needsAction, actionLabel, subjectName } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { useCapabilities } from '../../lib/capabilities'
import { threadHref } from '../../lib/builds'
import { Screen } from '../ui/Screen'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { AnimatedPressable } from '../ui/AnimatedPressable'
import { ListRow, ListSection, RowThumb } from '../list/list-kit'
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
  const typeLabel = tx.type === 'donation' ? 'Donation' : tx.type === 'build' ? 'Build' : 'Exchange'
  // A build's subject is the guide; toy_name is empty on one.
  const subject = subjectName(tx)
  // The board's one meta line: who it is with, which hat the viewer wears (a
  // leader's own toys and their organisation's arrive in one list), then the
  // one thing worth knowing next — the action, the lock, or the last word.
  const lastMessage = tx.last_message
    ? `${tx.last_message.sender_id === viewerId && tx.last_message.kind === 'user' ? 'You: ' : ''}${tx.last_message.body}`
    : null
  const meta = [
    // An open build nobody has claimed has nobody to name yet.
    tx.other_party_name ? `${typeLabel} with ${tx.other_party_name}` : `${typeLabel} · waiting for a maker`,
    tx.acting_for_org_name ? `On behalf of ${tx.acting_for_org_name}` : null,
    acting ? actionLabel(tx) : tx.blocked_by_rival_accept ? 'Locked — another request accepted' : lastMessage,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <ListRow
      onPress={onPress}
      accessibilityLabel={`${subject} with ${tx.other_party_name}`}
      accessibilityHint={`Status ${tx.status}.${acting ? ` ${actionLabel(tx)}.` : ''} Opens the exchange thread.`}
      thumb={<RowThumb photo={tx.toy_cover_photo_url} glyph="swap-horizontal-outline" />}
      title={`${subject}${tx.offered_toy_name ? ` ⇄ ${tx.offered_toy_name}` : ''}`}
      meta={meta}
      metaLines={3}
      pill={<Badge status={tx.status} />}
    />
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
      .get<ToyTransactionSummary[]>('/api/toy-transactions')
      .then((data) => {
        if (!ignore) setTransactions(data)
      })
      .catch((err) => {
        console.error('[ExchangesListScreen] transaction fetch failed:', err)
        if (!ignore) setError("Couldn't load your exchanges.")
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

  const goToThread = (tx: ToyTransactionSummary) => router.push(threadHref(tx))
  // undefined clears a param under React Navigation's setParams (which expo
  // Router's router.setParams delegates straight to) rather than merely
  // stringifying to "undefined" — verified against
  // node_modules/expo-router/build/global-state/router.js.
  const clearFilter = () => router.setParams({ toy: undefined })

  const renderRow = (item: ToyTransactionSummary) => (
    <View key={item.id} style={styles.rowWrap}>
      <TransactionRow tx={item} viewerId={viewerId} ledOrgIds={ledOrgIds} onPress={() => goToThread(item)} />
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
            Toys you have asked for, toys people have asked you for, and builds you have asked a
            maker for. Each one is a conversation until the handoff is confirmed.
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
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.ink} />
          }
          data={active}
          keyExtractor={(t) => t.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={active.length > 0 ? <ListSection>Active</ListSection> : null}
          renderItem={({ item }) => renderRow(item)}
          ListFooterComponent={
            history.length > 0 ? (
              <View style={styles.historySection}>
                <ListSection>History</ListSection>
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
  subtitle: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, lineHeight: 21 },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.accentLight,
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(2),
  },
  chipText: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.primaryDeep },
  retry: { marginTop: theme.spacing(5), alignSelf: 'center', paddingHorizontal: theme.spacing(8) },
  listContent: { paddingBottom: theme.spacing(6) },
  historySection: { marginTop: theme.spacing(6) },
  rowWrap: { marginBottom: theme.spacing(3) },
})
