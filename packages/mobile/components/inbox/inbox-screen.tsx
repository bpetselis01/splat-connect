// packages/mobile/components/inbox/inbox-screen.tsx
// One screen at two addresses: the Inbox tab and My SPLAT's Notifications row.
// The only difference is the header — the tab draws its own, the modal already
// has a native one — so `showHeader` is the whole fork rather than two files.
//
// Mobile's half of web's app/notifications/page.tsx + notifications-list.tsx.
// The copy and the routing live in lib/notifications.ts.
import { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { Notification, NotificationBucket, TutorialCollaboratorInvite } from '@splat-connect/types'
import { notificationBucket } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { COPY, linkFor, relativeTime } from '../../lib/notifications'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { ScreenHeader } from '../ui/ScreenHeader'
import { EmptyState } from '../ui/EmptyState'
import { SkeletonRow } from '../ui/Skeleton'
import { AnimatedPressable } from '../ui/AnimatedPressable'

// Order is deliberate: exchanges move fastest and are the likeliest thing
// someone opened the inbox for.
const BUCKETS: { key: NotificationBucket; title: string }[] = [
  { key: 'exchanges', title: 'Exchanges' },
  { key: 'tutorials', title: 'Tutorials' },
  { key: 'challenges', title: 'Challenges' },
]

function Row({
  n,
  inviteBusy,
  onOpen,
  onAccept,
  onDecline,
}: {
  n: Notification
  /** The invite id when this row still has one pending; undefined otherwise. */
  inviteBusy: { id: string; busy: boolean } | undefined
  onOpen: () => void
  onAccept: (inviteId: string) => void
  onDecline: (inviteId: string) => void
}) {
  const unread = n.read_at === null
  return (
    <Card style={[styles.row, !unread && styles.rowRead]}>
      <AnimatedPressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={COPY[n.type](n)}
        accessibilityHint={unread ? 'Unread. Opens it and marks it read.' : 'Opens it.'}
        pressScale={0.99}
        style={styles.rowPress}
      >
        {/* The dot is the unread marker; the bold line says the same thing to
            a screen reader through the hint above, so it is decorative here. */}
        <View style={[styles.dot, unread ? styles.dotUnread : styles.dotRead]} />
        <View style={styles.rowBody}>
          <Text style={[styles.rowText, unread && styles.rowTextUnread]}>{COPY[n.type](n)}</Text>
          <Text style={styles.stamp}>{relativeTime(n.created_at)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
      </AnimatedPressable>

      {inviteBusy ? (
        <View style={styles.inviteRow}>
          <Button
            label="Accept"
            variant="accent"
            disabled={inviteBusy.busy}
            onPress={() => onAccept(inviteBusy.id)}
            style={styles.inviteButton}
          />
          <Button
            label="Decline"
            variant="secondary"
            disabled={inviteBusy.busy}
            onPress={() => onDecline(inviteBusy.id)}
            style={styles.inviteButton}
          />
        </View>
      ) : null}
    </Card>
  )
}

export function InboxScreen({ showHeader = false }: { showHeader?: boolean }) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [invites, setInvites] = useState<TutorialCollaboratorInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [busyInvite, setBusyInvite] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    Promise.all([
      apiClient.get<Notification[]>('/api/notifications/me').catch((err) => {
        console.error('[InboxScreen] notifications fetch failed:', err)
        return [] as Notification[]
      }),
      // Losing this costs two buttons on one row; losing the inbox because of
      // it would cost everything else on the screen.
      apiClient.get<TutorialCollaboratorInvite[]>('/api/collaborators/me/invites').catch((err) => {
        console.error('[InboxScreen] invites fetch failed:', err)
        return [] as TutorialCollaboratorInvite[]
      }),
    ]).then(([rows, pending]) => {
      if (ignore) return
      setNotifications(rows)
      setInvites(pending)
      setLoading(false)
    })
    return () => {
      ignore = true
    }
  }, [reloadKey])

  const refetch = useCallback(() => setReloadKey((k) => k + 1), [])
  // Acting on anything from here changes what belongs here.
  useFocusEffect(refetch)

  const inviteByTutorial = new Map(invites.map((i) => [i.tutorial_id, i.id]))

  function open(n: Notification) {
    // Fire-and-forget: the read flag is bookkeeping, and making someone wait
    // on it — or stranding them when it fails — would be the tail wagging the
    // dog. The row is greyed locally so the screen agrees with itself.
    if (n.read_at === null) {
      setNotifications((cur) =>
        cur.map((row) => (row.id === n.id ? { ...row, read_at: new Date().toISOString() } : row))
      )
      apiClient
        .patch(`/api/notifications/${n.id}`, { read: true })
        .catch((err) => console.error('[InboxScreen] mark read failed:', err))
    }
    router.push(linkFor(n))
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

  const header = showHeader ? (
    <ScreenHeader title="Inbox" subtitle="Everything waiting on you, newest first." showLogo />
  ) : null

  if (loading) {
    return (
      <Screen>
        {header}
        <SkeletonRow />
        <SkeletonRow />
      </Screen>
    )
  }

  if (notifications.length === 0) {
    return (
      <Screen>
        {header}
        <EmptyState
          icon="notifications-outline"
          title="Nothing yet."
          hint="Requests, invites and challenge news land here."
        />
      </Screen>
    )
  }

  return (
    <Screen>
      {header}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {BUCKETS.map(({ key, title }) => {
          const rows = notifications.filter((n) => notificationBucket(n.type) === key)
          if (rows.length === 0) return null
          const unread = rows.filter((n) => n.read_at === null).length

          return (
            <View key={key} style={styles.group}>
              <View style={styles.eyebrowRow}>
                <Text style={styles.eyebrow}>{title}</Text>
                {unread > 0 ? (
                  <>
                    <Text style={styles.unreadCount}>{`${unread} unread`}</Text>
                    <Button
                      label="Mark read"
                      variant="ghost"
                      accessibilityLabel={`Mark ${title} read`}
                      onPress={() => void markBucketRead(key)}
                    />
                  </>
                ) : null}
              </View>

              {rows.map((n, i) => {
                const inviteId =
                  n.type === 'collaborator_invited' && n.tutorial_id
                    ? inviteByTutorial.get(n.tutorial_id)
                    : undefined
                return (
                  // Same settle as the library lists: capped stagger, because
                  // past the first screenful the delay is invisible latency.
                  <Animated.View
                    key={n.id}
                    entering={FadeInDown.delay(Math.min(i, 7) * theme.motion.stagger).duration(theme.motion.base)}
                  >
                    <Row
                      n={n}
                      inviteBusy={inviteId ? { id: inviteId, busy: busyInvite !== null } : undefined}
                      onOpen={() => open(n)}
                      onAccept={(id) => void answerInvite(id, 'accept')}
                      onDecline={(id) => void answerInvite(id, 'decline')}
                    />
                  </Animated.View>
                )
              })}
            </View>
          )
        })}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing(6) },
  group: { marginBottom: theme.spacing(4) },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2), marginBottom: theme.spacing(2) },
  eyebrow: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  unreadCount: {
    flex: 1,
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.primaryDeep,
  },
  row: { padding: theme.spacing(2), marginBottom: theme.spacing(2) },
  // Read rows recede rather than disappear — web drops them to 60% too.
  rowRead: { opacity: 0.6 },
  rowPress: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2), paddingHorizontal: theme.spacing(1) },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotUnread: { backgroundColor: theme.colors.apricot },
  dotRead: { backgroundColor: 'transparent' },
  rowBody: { flex: 1 },
  rowText: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.text,
    lineHeight: 20,
  },
  rowTextUnread: { fontFamily: theme.fonts.bold },
  stamp: {
    fontFamily: theme.fonts.regular,
    fontSize: 11,
    color: theme.colors.muted,
    marginTop: theme.spacing(1),
  },
  inviteRow: { flexDirection: 'row', gap: theme.spacing(2), marginTop: theme.spacing(2), paddingHorizontal: theme.spacing(1) },
  inviteButton: { paddingVertical: theme.spacing(2), paddingHorizontal: theme.spacing(4) },
})
