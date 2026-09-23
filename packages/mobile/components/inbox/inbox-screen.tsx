// packages/mobile/components/inbox/inbox-screen.tsx
// One screen at two addresses: the Inbox tab and My SPLAT's Notifications row.
// The tab draws its own title (the modal already has a native one) and opens
// on Exchanges; the Notifications row opens on Notifications.
//
// The board's inbox (#inbox): an Exchanges / Notifications switch over one
// card idiom — icon tile, bold line, preview, when, and an unread dot, with
// unread rows tinted as well. Exchanges are the transactions themselves (who,
// their last message); a notification about one lights its row's dot rather
// than repeating it as a line of its own.
//
// Mobile's half of web's app/notifications/page.tsx + notifications-list.tsx.
// The copy and the routing live in lib/notifications.ts.
import { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type {
  Notification,
  NotificationBucket,
  NotificationType,
  ToyTransactionSummary,
  TutorialCollaboratorInvite,
} from '@splat-connect/types'
import { notificationBucket, subjectName } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { threadHref } from '../../lib/builds'
import { useCapabilities } from '../../lib/capabilities'
import { copyFor, linkFor, relativeTime } from '../../lib/notifications'
import { Screen } from '../ui/Screen'
import { Button } from '../ui/Button'
import { ScreenHeader } from '../ui/ScreenHeader'
import { EmptyState } from '../ui/EmptyState'
import { SkeletonRow } from '../ui/Skeleton'
import { AnimatedPressable } from '../ui/AnimatedPressable'
import { Segmented } from '../ui/Segmented'

type IconName = React.ComponentProps<typeof Ionicons>['name']
export type InboxSegment = 'exchanges' | 'notifications'

// Order is deliberate: a guide's news before a challenge's before an
// organisation's. Exchanges have their own segment.
const BUCKETS: { key: Exclude<NotificationBucket, 'exchanges'>; title: string }[] = [
  { key: 'tutorials', title: 'Tutorials' },
  { key: 'challenges', title: 'Challenges' },
  // 077: organisations you follow publishing, and thanks to yours.
  { key: 'organisations', title: 'Organisations' },
]

const BUCKET_TILE: Record<NotificationBucket, { icon: IconName; tint: string }> = {
  exchanges: { icon: 'swap-horizontal', tint: theme.colors.mintSoft },
  tutorials: { icon: 'document-text-outline', tint: theme.colors.accentLight },
  challenges: { icon: 'bulb-outline', tint: theme.colors.honeySoft },
  organisations: { icon: 'business-outline', tint: theme.colors.violetSoft },
}
// The few types whose news is good or bad enough to say so in the tile.
const TYPE_TILE: Partial<Record<NotificationType, { icon: IconName; tint: string }>> = {
  tutorial_approved: { icon: 'checkmark-circle-outline', tint: theme.colors.successSoft },
  tutorial_rejected: { icon: 'return-up-back', tint: theme.colors.dangerSoft },
  tutorial_thanked: { icon: 'heart-outline', tint: theme.colors.apricotSoft },
}
const EXCHANGE_TINTS = [theme.colors.mintSoft, theme.colors.apricotSoft, theme.colors.violetSoft]
const TX_ICON: Record<ToyTransactionSummary['type'], IconName> = {
  donation: 'gift-outline',
  exchange: 'swap-horizontal',
  build: 'hammer-outline',
  print: 'print-outline',
}

/**
 * Whether the viewer wrote a message, read off the row alone so the inbox
 * needs no profile fetch: requester_name equals other_party_name exactly when
 * the viewer is the giving side (see ToyTransactionSummary). On an
 * organisation's toy any leader may have written it, so "not the family" is
 * the test there.
 */
function sentByViewer(tx: ToyTransactionSummary, senderId: string): boolean {
  const viewerGives = tx.requester_name !== null && tx.requester_name === tx.other_party_name
  if (!viewerGives) return senderId === tx.requester_id
  return tx.owner_id ? senderId === tx.owner_id : senderId !== tx.requester_id
}

/**
 * /api/toy-transactions also returns every open build on the Makers wanted
 * board — RLS lets any maker read one so they can claim it. Those are not the
 * viewer's conversations: an unclaimed build (no owner side yet) is theirs only
 * when they asked for it. Until the viewer is known, none is shown.
 */
function isParty(tx: ToyTransactionSummary, viewerId: string | undefined): boolean {
  const unclaimed = tx.owner_id === null && tx.owner_org_id === null
  return !unclaimed || tx.requester_id === viewerId
}

function InboxCard({
  icon,
  tint,
  title,
  body,
  when,
  unread,
  label,
  onPress,
  children,
}: {
  icon: IconName
  tint: string
  title: string
  body?: string | null
  when: string
  unread: boolean
  label: string
  onPress: () => void
  children?: React.ReactNode
}) {
  return (
    <View style={[styles.card, unread && styles.cardUnread]}>
      <AnimatedPressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={unread ? 'Unread. Opens it and marks it read.' : 'Opens it.'}
        pressScale={0.98}
        style={styles.cardPress}
      >
        <View style={[styles.tile, { backgroundColor: tint }]}>
          <Ionicons name={icon} size={20} color={theme.colors.ink} />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{title}</Text>
          {body ? (
            <Text style={styles.cardText} numberOfLines={2}>
              {body}
            </Text>
          ) : null}
          <Text style={styles.stamp}>{when}</Text>
        </View>
        {/* The dot is decorative: the hint says "Unread" to a screen reader. */}
        {unread ? <View style={styles.dot} /> : null}
      </AnimatedPressable>
      {children}
    </View>
  )
}

export function InboxScreen({
  showHeader = false,
  initialSegment,
}: {
  showHeader?: boolean
  /** Which half opens first. Left unset, Exchanges — unless it is empty and
   *  there are notifications, so nobody lands on a blank half. */
  initialSegment?: InboxSegment
}) {
  const router = useRouter()
  const viewerId = useCapabilities().caps?.profile.id
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [transactions, setTransactions] = useState<ToyTransactionSummary[]>([])
  const [invites, setInvites] = useState<TutorialCollaboratorInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [picked, setPicked] = useState<InboxSegment | undefined>(initialSegment)
  const [busyInvite, setBusyInvite] = useState<string | null>(null)
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
    Promise.all([
      apiClient.get<Notification[]>('/api/notifications/me').catch((err) => {
        console.error('[InboxScreen] notifications fetch failed:', err)
        return [] as Notification[]
      }),
      // Each of the other two degrades to empty on its own: losing the
      // exchanges list still leaves their notifications (drawn as plain rows
      // below), and losing invites costs two buttons on one row.
      apiClient.get<ToyTransactionSummary[]>('/api/toy-transactions').catch((err) => {
        console.error('[InboxScreen] exchanges fetch failed:', err)
        return [] as ToyTransactionSummary[]
      }),
      apiClient.get<TutorialCollaboratorInvite[]>('/api/collaborators/me/invites').catch((err) => {
        console.error('[InboxScreen] invites fetch failed:', err)
        return [] as TutorialCollaboratorInvite[]
      }),
    ]).then(([rows, txs, pending]) => {
      if (ignore) return
      setNotifications(rows)
      setTransactions(txs)
      setInvites(pending)
      setLoading(false)
      setRefreshing(false)
    })
    return () => {
      ignore = true
    }
  }, [reloadKey])

  const refetch = useCallback(() => setReloadKey((k) => k + 1), [])
  // Acting on anything from here changes what belongs here.
  useFocusEffect(refetch)

  const inviteByTutorial = new Map(invites.map((i) => [i.tutorial_id, i.id]))
  const exchangeNotes = notifications.filter((n) => notificationBucket(n.type) === 'exchanges')
  const unreadByTx = new Map<string, Notification[]>()
  for (const n of exchangeNotes) {
    if (n.read_at === null && n.toy_transaction_id) {
      unreadByTx.set(n.toy_transaction_id, [...(unreadByTx.get(n.toy_transaction_id) ?? []), n])
    }
  }
  const mine = transactions.filter((t) => isParty(t, viewerId))
  const txIds = new Set(mine.map((t) => t.id))
  // An exchange notification whose transaction is not in the list — the list
  // failed, or the row is one the viewer can no longer see — is still news.
  const orphans = exchangeNotes.filter((n) => !n.toy_transaction_id || !txIds.has(n.toy_transaction_id))
  const lastActive = (tx: ToyTransactionSummary) => Date.parse(tx.last_message?.created_at ?? tx.updated_at) || 0
  const threads = mine.sort((a, b) => lastActive(b) - lastActive(a))
  const exchangeUnread = exchangeNotes.filter((n) => n.read_at === null).length
  const others = notifications.filter((n) => notificationBucket(n.type) !== 'exchanges')

  const segment: InboxSegment =
    picked ?? (threads.length === 0 && orphans.length === 0 && others.length > 0 ? 'notifications' : 'exchanges')

  function markRead(ids: string[]) {
    // Fire-and-forget: the read flag is bookkeeping, and making someone wait
    // on it — or stranding them when it fails — would be the tail wagging the
    // dog. The row is marked locally so the screen agrees with itself.
    if (ids.length === 0) return
    const now = new Date().toISOString()
    setNotifications((cur) => cur.map((row) => (ids.includes(row.id) ? { ...row, read_at: now } : row)))
    for (const id of ids) {
      apiClient
        .patch(`/api/notifications/${id}`, { read: true })
        .catch((err) => console.error('[InboxScreen] mark read failed:', err))
    }
  }

  function open(n: Notification) {
    if (n.read_at === null) markRead([n.id])
    router.push(linkFor(n))
  }

  function openThread(tx: ToyTransactionSummary) {
    markRead((unreadByTx.get(tx.id) ?? []).map((n) => n.id))
    router.push(threadHref(tx))
  }

  async function markBucketRead(bucket: NotificationBucket) {
    const now = new Date().toISOString()
    // Optimistic, and not rolled back on failure: the next focus refetch is
    // the correction, and a count that flickers back is worse than one that
    // is briefly wrong.
    setNotifications((cur) =>
      cur.map((n) => (notificationBucket(n.type) === bucket && !n.read_at ? { ...n, read_at: now } : n))
    )
    try {
      await apiClient.post('/api/notifications/me/read', { bucket })
    } catch (err) {
      console.error('[InboxScreen] bucket mark-read failed:', err)
    }
  }

  async function answerInvite(inviteId: string, answer: 'accept' | 'decline') {
    setBusyInvite(inviteId)
    try {
      await apiClient.post(`/api/collaborators/invites/${inviteId}/${answer}`, {})
      refetch()
    } catch (err) {
      console.error(`[InboxScreen] invite ${answer} failed:`, err)
    } finally {
      setBusyInvite(null)
    }
  }

  function eyebrow(title: string, bucket: NotificationBucket, unread: number) {
    return (
      <View style={styles.eyebrowRow}>
        <Text style={styles.eyebrow}>{title}</Text>
        {unread > 0 ? (
          <>
            <Text style={styles.unreadCount}>{`${unread} unread`}</Text>
            <Button
              label="Mark read"
              variant="ghost"
              accessibilityLabel={`Mark ${title} read`}
              onPress={() => void markBucketRead(bucket)}
            />
          </>
        ) : null}
      </View>
    )
  }

  function noteCard(n: Notification) {
    const tile = TYPE_TILE[n.type] ?? BUCKET_TILE[notificationBucket(n.type)]
    const inviteId =
      n.type === 'collaborator_invited' && n.tutorial_id ? inviteByTutorial.get(n.tutorial_id) : undefined
    return (
      <InboxCard
        icon={tile.icon}
        tint={tile.tint}
        title={copyFor(n)}
        when={relativeTime(n.created_at)}
        unread={n.read_at === null}
        label={copyFor(n)}
        onPress={() => open(n)}
      >
        {inviteId ? (
          <View style={styles.inviteRow}>
            <Button
              label="Accept"
              variant="accent"
              disabled={busyInvite !== null}
              onPress={() => void answerInvite(inviteId, 'accept')}
              style={styles.inviteButton}
            />
            <Button
              label="Decline"
              variant="secondary"
              disabled={busyInvite !== null}
              onPress={() => void answerInvite(inviteId, 'decline')}
              style={styles.inviteButton}
            />
          </View>
        ) : null}
      </InboxCard>
    )
  }

  // Same settle as the library lists: capped stagger, because past the first
  // screenful the delay is invisible latency.
  const settle = (i: number) => FadeInDown.delay(Math.min(i, 7) * theme.motion.stagger).duration(theme.motion.base)

  const header = showHeader ? <ScreenHeader title="Inbox" /> : null
  const segments = (
    <View style={styles.segments}>
      <Segmented
        label="Inbox"
        variant="pills"
        value={segment}
        onChange={setPicked}
        options={[
          { value: 'exchanges', label: 'Exchanges' },
          { value: 'notifications', label: 'Notifications' },
        ]}
      />
    </View>
  )

  if (loading) {
    return (
      <Screen ownHeader={showHeader}>
        {header}
        {segments}
        <SkeletonRow />
        <SkeletonRow />
      </Screen>
    )
  }

  const empty =
    segment === 'exchanges' ? threads.length === 0 && orphans.length === 0 : others.length === 0

  return (
    <Screen ownHeader={showHeader}>
      {header}
      {segments}
      {empty ? (
        <EmptyState
          icon={segment === 'exchanges' ? 'swap-horizontal' : 'notifications-outline'}
          title="Nothing yet."
          hint={
            segment === 'exchanges'
              ? 'Toy requests and the messages about them land here.'
              : 'Invites, reviews and challenge news land here.'
          }
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.ink} />
          }
        >
          {segment === 'exchanges' ? (
            <View style={styles.group}>
              {exchangeUnread > 0 ? eyebrow('Exchanges', 'exchanges', exchangeUnread) : null}
              {threads.map((tx, i) => {
                const subject = subjectName(tx)
                const party = tx.other_party_name || subject
                const last = tx.last_message
                const preview = last ? `${last.kind === 'user' && sentByViewer(tx, last.sender_id) ? 'You: ' : ''}${last.body}` : subject
                return (
                  <Animated.View key={tx.id} entering={settle(i)}>
                    <InboxCard
                      icon={TX_ICON[tx.type] ?? 'swap-horizontal'}
                      tint={EXCHANGE_TINTS[i % EXCHANGE_TINTS.length]}
                      title={party}
                      body={preview}
                      when={relativeTime(last?.created_at ?? tx.updated_at)}
                      unread={unreadByTx.has(tx.id)}
                      label={`${subject} with ${party}`}
                      onPress={() => openThread(tx)}
                    />
                  </Animated.View>
                )
              })}
              {orphans.map((n, i) => (
                <Animated.View key={n.id} entering={settle(threads.length + i)}>
                  {noteCard(n)}
                </Animated.View>
              ))}
            </View>
          ) : (
            BUCKETS.map(({ key, title }) => {
              const rows = others.filter((n) => notificationBucket(n.type) === key)
              if (rows.length === 0) return null
              return (
                <View key={key} style={styles.group}>
                  {eyebrow(title, key, rows.filter((n) => n.read_at === null).length)}
                  {rows.map((n, i) => (
                    <Animated.View key={n.id} entering={settle(i)}>
                      {noteCard(n)}
                    </Animated.View>
                  ))}
                </View>
              )
            })
          )}
        </ScrollView>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  segments: { marginBottom: 14 },
  content: { paddingBottom: theme.spacing(6) },
  group: { marginBottom: theme.spacing(4) },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2), marginBottom: theme.spacing(2) },
  eyebrow: {
    fontFamily: theme.fonts.black,
    fontSize: 12,
    color: theme.colors.muted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  unreadCount: {
    flex: 1,
    fontFamily: theme.fonts.semiBold,
    fontSize: theme.type.caption,
    color: theme.colors.primaryDeep,
  },
  card: {
    marginBottom: 11,
    padding: 15,
    borderRadius: theme.radii.panel,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    ...theme.shadow(1),
  },
  // Unread carries a tint as well as a dot — the board's rule, so the state
  // does not rest on one small coloured circle.
  cardUnread: { backgroundColor: theme.colors.accentFaint },
  cardPress: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  tile: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitle: { fontFamily: theme.fonts.black, fontSize: theme.type.label, lineHeight: 18, color: theme.colors.ink },
  cardText: { fontFamily: theme.fonts.regular, fontSize: 12.5, lineHeight: 18, color: theme.colors.muted, marginTop: 2 },
  stamp: { fontFamily: theme.fonts.semiBold, fontSize: 11, color: theme.colors.muted, marginTop: 5 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: theme.colors.apricot, marginTop: 6 },
  inviteRow: { flexDirection: 'row', gap: theme.spacing(2), marginTop: theme.spacing(3), paddingLeft: 52 },
  inviteButton: { paddingVertical: theme.spacing(2), paddingHorizontal: theme.spacing(4) },
})
