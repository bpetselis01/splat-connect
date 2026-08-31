// packages/mobile/components/exchanges/thread-screen.tsx
/**
 * One exchange: the conversation, and the controls that move it through its
 * lifecycle. The mobile counterpart of web's toy-transaction-thread.tsx +
 * exchange-chat.tsx + accept-pickup-dialog.tsx, collapsed into one screen —
 * there is no room for web's two-column sidebar on a phone, so the transaction
 * state reads as a stack: what is being swapped, where to meet, your code, the
 * conversation, and one footer of whatever you can actually do right now.
 *
 * The donation/exchange asymmetry is why `showMyCode` and `canConfirm` are two
 * expressions rather than one "can act" flag, exactly as on web: a donation is
 * one-way (the requester holds a code, the owner types it in), an exchange is
 * mutual, so on a donation each party sees exactly one of the two.
 *
 * Every rule here is the API's (packages/api/src/routes/toy-transactions.ts) —
 * a client that guesses differently puts two people in a room reciting a
 * number that cannot match.
 */
import { useCallback, useRef, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import type { ToyTransaction, ToyTransactionDetail, ToyTransactionMessage } from '@splat-connect/types'
import { isOwnerSide, needsAction, actionLabel } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { useCapabilities } from '../../lib/capabilities'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { ErrorRow } from '../auth-screen'

const POLL_MS = 10_000
const LOAD_ERROR = "Couldn't load this exchange."

const PICKUP_FIELDS = [
  { key: 'pickup_line1', label: 'Street address' },
  { key: 'pickup_suburb', label: 'Suburb' },
  { key: 'pickup_state', label: 'State' },
  { key: 'pickup_postcode', label: 'Postcode' },
] as const

type PickupDraft = Record<(typeof PICKUP_FIELDS)[number]['key'], string>

/**
 * The API writes its 4xx bodies for humans — "Incorrect code", "Your
 * organisation needs a pickup address before you can accept requests" — and
 * api-client folds them into the thrown Error's message. Showing a generic
 * apology instead would hide the only sentence that tells someone what to do.
 * 5xx keeps the fallback: a raw Postgres error is not copy.
 */
function apiMessage(err: unknown, fallback: string): string {
  const match = /failed with status 4\d\d: (.+)$/.exec(err instanceof Error ? err.message : '')
  return match ? match[1] : fallback
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
}

function MessageRow({
  message,
  mine,
  senderName,
}: {
  message: ToyTransactionMessage
  mine: boolean
  senderName: string
}) {
  if (message.kind === 'system') {
    return (
      <View style={styles.systemRow}>
        <Text style={styles.systemText}>{message.body}</Text>
      </View>
    )
  }
  return (
    <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
      <View
        // Left/right and the tint are the only things separating your messages
        // from theirs on screen, and neither reaches a screen reader.
        accessible
        accessibilityLabel={`${mine ? 'You' : senderName} said: ${message.body}`}
        style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}
      >
        {!mine ? <Text style={styles.bubbleWho}>{senderName}</Text> : null}
        <Text style={styles.bubbleText}>{message.body}</Text>
        <Text style={styles.stamp}>{timeOf(message.created_at)}</Text>
      </View>
    </View>
  )
}

export function ExchangeThreadScreen({ id }: { id: string }) {
  const router = useRouter()
  const { caps } = useCapabilities()
  const [tx, setTx] = useState<ToyTransactionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState('')
  const [code, setCode] = useState('')
  const [pickup, setPickup] = useState<PickupDraft | null>(null)
  const logRef = useRef<ScrollView>(null)
  // Bumped by every write. A poll that was already in flight when someone
  // accepted or confirmed answers with the row as it was BEFORE their action,
  // and applying it reverts the footer under them until the next tick.
  const generation = useRef(0)

  const load = useCallback(async () => {
    const at = generation.current
    try {
      const fresh = await apiClient.get<ToyTransactionDetail>(`/api/toy-transactions/${id}`)
      if (generation.current !== at) return
      setTx(fresh)
      // Only the stale-data warning is cleared. A poll landing a second after
      // someone mistyped their code must not wipe "Incorrect code" out from
      // under them — that is the one line telling them what went wrong.
      setError((cur) => (cur === LOAD_ERROR ? null : cur))
    } catch (err) {
      console.error('[ExchangeThreadScreen] transaction fetch failed:', err)
      if (generation.current !== at) return
      setError(LOAD_ERROR)
    } finally {
      setLoading(false)
    }
  }, [id])

  // Poll while focused. The web thread's live messaging was shipped
  // thread-only and this mirrors it — no realtime subscription on mobile in
  // this pass. Cleared on blur so a backgrounded screen is not still talking.
  useFocusEffect(
    useCallback(() => {
      load()
      const timer = setInterval(load, POLL_MS)
      return () => clearInterval(timer)
    }, [load])
  )

  const viewerId = caps?.profile.id ?? ''
  const ledOrgIds = caps?.ledOrgs.map((o) => o.id) ?? []

  /**
   * Actions answer with the fresh transaction row, so the response IS the
   * refetch — merged over what is on screen, which keeps the enrichment the
   * row itself does not carry (names, messages). The system message the API
   * writes alongside arrives on the next poll.
   */
  async function run(action: () => Promise<ToyTransaction>): Promise<boolean> {
    generation.current += 1
    setBusy(true)
    setError(null)
    try {
      const fresh = await action()
      setTx((cur) => (cur ? { ...cur, ...fresh } : cur))
      return true
    } catch (err) {
      setError(apiMessage(err, 'Something went wrong. Please try again.'))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function send() {
    const body = draft.trim()
    if (!body) return
    generation.current += 1
    setBusy(true)
    setError(null)
    try {
      const created = await apiClient.post<ToyTransactionMessage>(
        `/api/toy-transactions/${id}/messages`,
        { body }
      )
      setDraft('')
      // Appended rather than refetched: the POST already returns the created
      // message, and the next poll replaces the whole array from the server
      // anyway, so a second round trip would buy nothing.
      setTx((cur) => (cur ? { ...cur, messages: [...cur.messages, created] } : cur))
    } catch (err) {
      setError(apiMessage(err, 'Could not send that message. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <Screen>
        <SkeletonRow />
        <SkeletonRow />
      </Screen>
    )
  }

  if (!tx) {
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title={LOAD_ERROR}
          hint="Check your connection and try again."
        >
          <Button
            label="Try again"
            variant="secondary"
            onPress={() => {
              setLoading(true)
              void load()
            }}
            style={styles.retry}
          />
        </EmptyState>
      </Screen>
    )
  }

  const isOwner = isOwnerSide(tx, viewerId, ledOrgIds)
  const otherPartyName = isOwner ? tx.requester_name : tx.owner_name
  // Keyed off the requester rather than the owner: an org handoff has no
  // owner_id, so every message a leader sent would otherwise be attributed to
  // the family. owner_name is the organisation's name in that case.
  const nameFor = (senderId: string) => (senderId === tx.requester_id ? tx.requester_name : tx.owner_name)

  const isOpen = tx.status === 'requested' || tx.status === 'accepted'
  const blocked = tx.status === 'requested' && isOwner && tx.blocked_by_rival_accept
  const myCode = isOwner ? tx.owner_code : tx.requester_code
  const showMyCode = tx.status === 'accepted' && (tx.type === 'exchange' || !isOwner)
  const canConfirm = tx.status === 'accepted' && (tx.type === 'exchange' || isOwner)
  const alreadyConfirmed = isOwner ? tx.owner_confirmed_at !== null : tx.requester_confirmed_at !== null

  const swapLine = tx.offered_toy_name
    ? `${tx.toy_name} ⇄ ${tx.offered_toy_name}`
    : `${tx.toy_name} → ${isOwner ? `${tx.requester_name} collects` : 'You collect'}`

  const waiting = blocked
    ? 'Locked — another request accepted'
    : needsAction(tx, viewerId, ledOrgIds)
      ? actionLabel(tx)
      : isOpen
        ? `Waiting on ${otherPartyName}`
        : null

  const pickupAddress = [tx.pickup_line1, tx.pickup_suburb, tx.pickup_state, tx.pickup_postcode]
    .filter(Boolean)
    .join(', ')
  const pickupComplete = pickup !== null && PICKUP_FIELDS.every((f) => pickup[f.key].trim())
  // Captured here rather than read off tx.received_toy inside the Button's
  // onPress below — same reason as editor.tsx's currentSwitchPhotoUrls: TS
  // does not carry the narrowing from an optional-chained property access
  // across a nested closure.
  const receivedToy = tx.status === 'completed' && tx.received_toy?.status === 'draft' ? tx.received_toy : null

  return (
    // `padding` shrinks Screen's flex:1 child by the keyboard's height on
    // iOS, which pushes the footer's composer up above it. Android's own
    // resize (windowSoftInputMode) already does this at the OS level, so no
    // `behavior` there.
    //
    // keyboardVerticalOffset would ideally be useHeaderHeight() from
    // @react-navigation/elements — this stack has a native header
    // ("Exchange", set in app/(my)/_layout.tsx) sitting above Screen, and
    // this view's own top is below it, not at y=0. Without that offset the
    // padding this adds may fall short by roughly the header's height,
    // leaving a sliver of the composer still covered. That package isn't in
    // this tree; revisit if that gap turns out to be visible in practice.
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <ScrollView
          ref={logRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          onContentSizeChange={() => logRef.current?.scrollToEnd({ animated: false })}
        >
          <Card variant="feature" style={styles.headerCard}>
            <View style={styles.headerTop}>
              <Text style={styles.swapLine}>{swapLine}</Text>
              <Badge status={tx.status} />
            </View>
            <Text style={styles.headerMeta}>
              {tx.type === 'donation' ? 'Donation' : 'Exchange'} with {otherPartyName}
            </Text>
            {waiting ? <Text style={styles.waiting}>{waiting}</Text> : null}
          </Card>

          {tx.status === 'accepted' && pickupAddress ? (
            <Card style={styles.block}>
              <Text style={styles.blockTitle}>Pickup</Text>
              <Text style={styles.blockBody}>{pickupAddress}</Text>
              {/* Where a leader writes "side gate, code 4417" — copied onto the
                  transaction at accept time so the requester can read it here. */}
              {tx.pickup_instructions ? (
                <Text style={styles.blockBody}>{tx.pickup_instructions}</Text>
              ) : null}
            </Card>
          ) : null}

          {showMyCode && myCode ? (
            <Card style={styles.block}>
              <Text style={styles.blockTitle}>
                Your handoff code: <Text style={styles.codeDigits}>{myCode}</Text>
              </Text>
              <Text style={styles.blockBody}>Read this to {otherPartyName} at pickup.</Text>
            </Card>
          ) : null}

          {/* Mirrors web's toy-transaction-thread.tsx (lines 256-266): the toy
              THIS viewer walked away with, present only once the handoff is
              complete and still a draft — already listed or given away by
              the time this loads, there is nothing left to prompt. */}
          {receivedToy ? (
            <Card style={styles.block}>
              <Text style={styles.blockTitle}>Handoff complete.</Text>
              <Text style={styles.blockBody}>
                {receivedToy.name} is yours now. Add it to the toy library if you would like
                others to be able to request it.
              </Text>
              <Button
                label="Add to toy library"
                variant="accent"
                onPress={() => router.push(`/toys/${receivedToy.id}`)}
              />
            </Card>
          ) : null}

          <View
            accessibilityRole="list"
            accessibilityLabel="Conversation"
            style={styles.log}
          >
            {tx.messages.map((m) => (
              <MessageRow
                key={m.id}
                message={m}
                mine={m.sender_id === viewerId && m.kind === 'user'}
                senderName={nameFor(m.sender_id)}
              />
            ))}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <ErrorRow message={error} />

          {isOpen ? (
            <View style={styles.composer}>
              {/* TextField owns its own outer wrapper, so the flex that makes the
                  input take the row's spare width has to go on a view around it. */}
              <View style={styles.composerField}>
                <TextField
                  accessibilityLabel={`Message ${otherPartyName}`}
                  placeholder={`Message ${otherPartyName}…`}
                  value={draft}
                  onChangeText={setDraft}
                  multiline
                  style={styles.composerInput}
                />
              </View>
              <Button label="Send" disabled={busy || !draft.trim()} onPress={send} style={styles.sendButton} />
            </View>
          ) : null}

          {tx.status === 'requested' && isOwner ? (
            pickup ? (
              <View style={styles.actionBlock}>
                <Text style={styles.blockTitle}>Where should they collect it?</Text>
                <Text style={styles.blockBody}>
                  This is shared with the other party once you accept, so they know where to meet you.
                </Text>
                {PICKUP_FIELDS.map((field) => (
                  <TextField
                    key={field.key}
                    label={field.label}
                    accessibilityLabel={field.label}
                    autoComplete="off"
                    value={pickup[field.key]}
                    onChangeText={(text) => setPickup({ ...pickup, [field.key]: text })}
                  />
                ))}
                <Button
                  label="Accept request"
                  variant="accent"
                  disabled={busy || !pickupComplete}
                  // The form stays up until the server takes it: a 400 for an
                  // address it will not accept must not also throw away what the
                  // owner typed.
                  onPress={async () => {
                    const sent = await run(() =>
                      apiClient.post<ToyTransaction>(`/api/toy-transactions/${id}/accept`, pickup)
                    )
                    if (sent) setPickup(null)
                  }}
                />
                <Button label="Cancel" variant="ghost" onPress={() => setPickup(null)} />
              </View>
            ) : (
              <View style={styles.actionBlock}>
                <Text style={styles.blockBody}>
                  {tx.owner_org_id
                    ? "Accepting shares your organisation's pickup address and gives you both a handoff code."
                    : 'Accepting shares your pickup address and gives you both a handoff code.'}
                </Text>
                {blocked ? (
                  <Text style={styles.blockBody}>
                    You need to either complete the current transaction or withdraw from it.
                  </Text>
                ) : null}
                <View style={styles.buttonRow}>
                  <Button
                    label="Accept"
                    variant="accent"
                    disabled={busy || blocked}
                    style={styles.rowButton}
                    // No address form for an organisation: its pickup point is
                    // fixed, the server reads it from the org record and ignores
                    // anything sent here, so asking would be a form whose answer
                    // is discarded.
                    onPress={() =>
                      tx.owner_org_id
                        ? run(() => apiClient.post<ToyTransaction>(`/api/toy-transactions/${id}/accept`, {}))
                        : // Seeded from the owner's saved profile address, the same
                          // default web's dialog offers. Every field stays editable —
                          // a pickup is not always at home.
                          setPickup({
                            pickup_line1: caps?.profile.pickup_line1 ?? '',
                            pickup_suburb: caps?.profile.pickup_suburb ?? '',
                            pickup_state: caps?.profile.pickup_state ?? '',
                            pickup_postcode: caps?.profile.pickup_postcode ?? '',
                          })
                    }
                  />
                  {/* Declining stays live while blocked: turning down a request
                      the owner does not want is harmless mid-handoff on another. */}
                  <Button
                    label="Decline"
                    variant="secondary"
                    disabled={busy}
                    style={styles.rowButton}
                    onPress={() => run(() => apiClient.post<ToyTransaction>(`/api/toy-transactions/${id}/reject`, {}))}
                  />
                </View>
              </View>
            )
          ) : null}

          {canConfirm && !alreadyConfirmed ? (
            <View style={styles.actionBlock}>
              <TextField
                label="Enter their code"
                accessibilityLabel="Enter their code"
                hint={`The six digits ${otherPartyName} reads out when the toy changes hands.`}
                inputMode="numeric"
                value={code}
                onChangeText={setCode}
              />
              <Button
                label="Confirm handoff"
                variant="accent"
                disabled={busy || !code.trim()}
                onPress={async () => {
                  const sent = await run(() =>
                    apiClient.post<ToyTransaction>(`/api/toy-transactions/${id}/confirm`, { code })
                  )
                  // Left in place on failure — "Incorrect code" is easiest to
                  // fix by editing what's already there, not retyping it.
                  if (sent) setCode('')
                }}
              />
            </View>
          ) : null}

          {/* Without this, confirming made the input disappear and put nothing
              in its place, which reads as a tap that failed. */}
          {canConfirm && alreadyConfirmed ? (
            <Text style={styles.confirmedNote}>Waiting on the other side to confirm</Text>
          ) : null}

          {/* Either side, for as long as the transaction is open — the API allows
              it on `requested` OR `accepted` from both parties, and an accepted
              handoff that falls through otherwise traps both people and keeps the
              toy locked against every rival request. Hidden while the pickup form
              is up, where a second way out under Cancel is only noise. */}
          {isOpen && !pickup ? (
            <Button
              // Web's label, not "Withdraw request" — the owner half of this
              // button never made a request, so "request" is only ever true
              // for the other party reading the same word.
              label="Withdraw"
              variant="secondary"
              disabled={busy}
              style={styles.actionBlock}
              onPress={() => run(() => apiClient.post<ToyTransaction>(`/api/toy-transactions/${id}/withdraw`, {}))}
            />
          ) : null}
        </View>
      </Screen>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  retry: { marginTop: theme.spacing(5), alignSelf: 'center', paddingHorizontal: theme.spacing(8) },
  scrollContent: { paddingBottom: theme.spacing(4) },
  headerCard: { gap: theme.spacing(2), marginBottom: theme.spacing(3) },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
  },
  swapLine: { flex: 1, fontFamily: theme.fonts.black, fontSize: theme.type.heading, color: theme.colors.text },
  headerMeta: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted },
  waiting: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.apricotDeep },
  block: { gap: theme.spacing(1), marginBottom: theme.spacing(3), padding: theme.spacing(3) },
  blockTitle: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.text },
  blockBody: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    lineHeight: 21,
  },
  // Jersey 10 is numerals-only, which is exactly what this is.
  codeDigits: { fontFamily: theme.fonts.numeral, fontSize: theme.type.title, color: theme.colors.primaryDeep },
  log: { gap: theme.spacing(2) },
  systemRow: { alignItems: 'center', paddingVertical: theme.spacing(1) },
  systemText: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    textAlign: 'center',
    borderWidth: theme.border.thin,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sm,
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(1),
  },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '82%',
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(2),
    gap: theme.spacing(1),
  },
  bubbleMine: { backgroundColor: theme.colors.accentLight },
  bubbleTheirs: { backgroundColor: theme.colors.surface },
  bubbleWho: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.primaryDeep },
  bubbleText: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.text, lineHeight: 20 },
  stamp: { fontFamily: theme.fonts.regular, fontSize: 11, color: theme.colors.muted, alignSelf: 'flex-end' },
  footer: {
    borderTopWidth: theme.border.thin,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing(3),
  },
  composer: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing(2) },
  composerField: { flex: 1 },
  composerInput: { maxHeight: 96 },
  sendButton: { paddingHorizontal: theme.spacing(4) },
  actionBlock: { gap: theme.spacing(2), marginTop: theme.spacing(1) },
  buttonRow: { flexDirection: 'row', gap: theme.spacing(2) },
  rowButton: { flex: 1 },
  confirmedNote: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    marginTop: theme.spacing(1),
  },
})
