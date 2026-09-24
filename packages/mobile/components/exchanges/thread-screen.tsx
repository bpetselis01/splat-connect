// packages/mobile/components/exchanges/thread-screen.tsx
/**
 * One exchange: the conversation, and the controls that move it through its
 * lifecycle. The mobile counterpart of web's toy-transaction-thread.tsx +
 * exchange-chat.tsx + accept-pickup-dialog.tsx, collapsed into one screen —
 * there is no room for web's two-column sidebar on a phone, so the transaction
 * state reads as the board's stack: what is being swapped, what it costs, the
 * four-step rail, the WAITING ON card (where to meet, your code, and whatever
 * you can do right now), the conversation, and the composer pinned below.
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
import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type {
  ExchangeCost,
  ExchangeSettlement,
  ToyTransaction,
  ToyTransactionDetail,
  ToyTransactionMessage,
} from '@splat-connect/types'
import { isOwnerSide, needsAction, actionLabel, formatCents, apiMessage } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { useCapabilities } from '../../lib/capabilities'
import { threadHref } from '../../lib/builds'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { MessageBubble } from '../ui/MessageBubble'
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

const STAGES = ['Requested', 'Accepted', 'Handover', 'Closed'] as const
export type StageState = 'done' | 'current' | 'todo'

/**
 * The board's four-step rail. Accepting starts the handover at once — the
 * codes exist from that moment — so "Accepted" is never the step in progress.
 * A request that closed early (declined, withdrawn) keeps Accepted only if it
 * got that far, which the owner's code records: 'accept' is what issues it.
 */
export function stageRail(tx: Pick<ToyTransaction, 'status' | 'owner_code'>): StageState[] {
  switch (tx.status) {
    case 'requested':
      return ['current', 'todo', 'todo', 'todo']
    case 'accepted':
      return ['done', 'done', 'current', 'todo']
    case 'completed':
      return ['done', 'done', 'done', 'done']
    default:
      return ['done', tx.owner_code ? 'done' : 'todo', 'todo', 'done']
  }
}

/**
 * Who the exchange is waiting on, if anyone: the viewer (the required action,
 * which the screen never scrolls past), the other side, or nobody because a
 * rival request already holds the toy.
 */
export function waitingOn(
  tx: ToyTransactionDetail,
  viewerId: string,
  ledOrgIds: readonly string[]
): { who: 'you' | 'them' | 'locked'; label: string } | null {
  const isOwner = isOwnerSide(tx, viewerId, ledOrgIds)
  if (tx.status === 'requested' && isOwner && tx.blocked_by_rival_accept) {
    return { who: 'locked', label: 'Locked — another request accepted' }
  }
  if (needsAction(tx, viewerId, ledOrgIds)) return { who: 'you', label: actionLabel(tx) }
  if (tx.status === 'requested' || tx.status === 'accepted') {
    return {
      who: 'them',
      label: `Waiting on ${isOwner ? tx.requester_name : tx.owner_name}`,
    }
  }
  return null
}

type CostLine = Pick<ExchangeCost, 'id' | 'description' | 'amount_cents' | 'claiming' | 'payer_id' | 'payee_id'>
type CostPanel = {
  lines: CostLine[]
  settlement: Pick<ExchangeSettlement, 'method'> | null
}

/** What the viewer pays back, or is paid back. Only claimed lines count (055). */
export function costSummary(lines: CostLine[], viewerId: string): { youPay: number; youGet: number } {
  const claimed = lines.filter((l) => l.claiming)
  const sum = (ls: CostLine[]) => ls.reduce((n, l) => n + l.amount_cents, 0)
  return {
    youPay: sum(claimed.filter((l) => l.payer_id === viewerId)),
    youGet: sum(claimed.filter((l) => l.payee_id === viewerId)),
  }
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
  const [costs, setCosts] = useState<CostPanel | null>(null)
  const txType = tx?.type

  // The cost panel (055/056). Once per screen, not per poll: lines change on
  // the dashboard, not mid-handover. RLS returns empty arrays to a stranger.
  useEffect(() => {
    if (txType !== 'donation' && txType !== 'exchange') return
    let ignore = false
    apiClient
      .get<CostPanel>(`/api/exchange-costs/${id}`)
      .then((c) => {
        if (!ignore) setCosts(c)
      })
      .catch((err) => console.error('[ExchangeThreadScreen] cost fetch failed:', err))
    return () => {
      ignore = true
    }
  }, [id, txType])

  const load = useCallback(async () => {
    const at = generation.current
    try {
      const fresh = await apiClient.get<ToyTransactionDetail>(`/api/toy-transactions/${id}`)
      if (generation.current !== at) return
      // A build has its own thread (rail, working shot); a notification or
      // link that only knew the transaction id lands here first.
      if (fresh.type === 'build') {
        router.replace(threadHref(fresh))
        return
      }
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
  }, [id, router])

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
      const created = await apiClient.post<ToyTransactionMessage>(`/api/toy-transactions/${id}/messages`, { body })
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
        <EmptyState icon="cloud-offline-outline" title={LOAD_ERROR} hint="Check your connection and try again.">
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
  const myCode = isOwner ? tx.owner_code : tx.requester_code
  const showMyCode = tx.status === 'accepted' && (tx.type === 'exchange' || !isOwner)
  const canConfirm = tx.status === 'accepted' && (tx.type === 'exchange' || isOwner)
  const alreadyConfirmed = isOwner ? tx.owner_confirmed_at !== null : tx.requester_confirmed_at !== null

  const swapLine = tx.offered_toy_name
    ? `${tx.toy_name} ⇄ ${tx.offered_toy_name}`
    : `${tx.toy_name} → ${isOwner ? `${tx.requester_name} collects` : 'You collect'}`

  const waiting = waitingOn(tx, viewerId, ledOrgIds)
  const rail = stageRail(tx)

  const pickupAddress = [tx.pickup_line1, tx.pickup_suburb, tx.pickup_state, tx.pickup_postcode]
    .filter(Boolean)
    .join(', ')
  const pickupComplete = pickup !== null && PICKUP_FIELDS.every((f) => pickup[f.key].trim())
  // Captured here rather than read off tx.received_toy inside the Button's
  // onPress below — same reason as editor.tsx's currentSwitchPhotoUrls: TS
  // does not carry the narrowing from an optional-chained property access
  // across a nested closure.
  const receivedToy = tx.status === 'completed' && tx.received_toy?.status === 'draft' ? tx.received_toy : null

  const costLines = costs?.lines ?? []
  const { youPay, youGet } = costSummary(costLines, viewerId)
  const method = costs?.settlement?.method ?? null

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
          // "The required action is never scrolled past": while something is
          // waiting on the viewer the screen opens at the top, on that card.
          // Otherwise it follows the conversation as before.
          onContentSizeChange={() => {
            if (waiting?.who !== 'you') logRef.current?.scrollToEnd({ animated: false })
          }}
        >
          <Card style={styles.headerCard}>
            <View style={styles.toyTile}>
              <Ionicons name="cube-outline" size={22} color={theme.colors.muted} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.swapLine}>{swapLine}</Text>
              <Text style={styles.headerMeta}>
                {tx.type === 'donation'
                  ? `Donation · ${isOwner ? 'to' : 'from'} ${otherPartyName}`
                  : `Exchange with ${otherPartyName}`}
              </Text>
            </View>
            <Badge status={tx.status} />
          </Card>

          {costLines.length > 0 ? (
            <Card style={styles.block}>
              <Text style={styles.eyebrow}>What the handover costs you</Text>
              {costLines.map((l) => (
                <View key={l.id} style={styles.costLine}>
                  <Text style={styles.costDesc}>{l.description}</Text>
                  <Text style={styles.costAmount}>{formatCents(l.claiming ? l.amount_cents : 0)}</Text>
                </View>
              ))}
              {youPay > 0 || youGet > 0 ? (
                <View style={[styles.payBack, youPay > 0 ? styles.payBackYou : styles.payBackThem]}>
                  <Text style={styles.payBackLabel}>{youPay > 0 ? 'You pay back' : 'They pay you back'}</Text>
                  <Text style={styles.payBackAmount}>{formatCents(youPay > 0 ? youPay : youGet)}</Text>
                </View>
              ) : null}
              {method ? (
                <View style={styles.methodRow}>
                  <Ionicons name="business-outline" size={15} color={theme.colors.muted} />
                  <Text style={styles.blockBody}>{method}</Text>
                </View>
              ) : null}
            </Card>
          ) : null}

          <Card style={styles.railCard}>
            <View accessibilityRole="list" accessibilityLabel="Stages" style={styles.rail}>
              {STAGES.map((label, i) => (
                <View
                  key={label}
                  accessible
                  accessibilityLabel={`${label}, ${rail[i] === 'current' ? 'in progress' : rail[i]}`}
                  testID={`stage-${label}-${rail[i]}`}
                  style={styles.stage}
                >
                  {/* The step speaks through its own label above; the dot and
                      the word are drawn for sight only, so "Accepted" is not
                      read twice beside the status badge. */}
                  <View
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    style={styles.stageInner}
                  >
                    <View style={styles.stageTop}>
                      <View style={[styles.stageDot, styles[`dot_${rail[i]}`]]}>
                        {rail[i] === 'done' ? <Ionicons name="checkmark" size={13} color="#ffffff" /> : null}
                      </View>
                      {i < STAGES.length - 1 ? (
                        <View style={[styles.stageBar, rail[i + 1] !== 'todo' && styles.stageBarDone]} />
                      ) : null}
                    </View>
                    <Text style={[styles.stageLabel, rail[i] === 'todo' && styles.stageLabelTodo]} numberOfLines={1}>
                      {label}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>

          {waiting || (showMyCode && myCode) || (canConfirm && isOpen) ? (
            <View
              testID={`waiting-${waiting?.who ?? 'none'}`}
              style={[styles.waitCard, styles[`wait_${waiting?.who ?? 'them'}`]]}
            >
              {waiting ? (
                <View style={styles.eyebrowRow}>
                  <Ionicons name="hourglass-outline" size={13} color={theme.colors.ink} />
                  <Text style={styles.eyebrow}>{waiting.label}</Text>
                </View>
              ) : null}

              {tx.status === 'accepted' && pickupAddress ? (
                <View style={styles.pickup}>
                  <Text style={styles.pickupTitle}>{pickupAddress}</Text>
                  {/* Where a leader writes "side gate, code 4417" — copied onto the
                      transaction at accept time so the requester can read it here. */}
                  {tx.pickup_instructions ? <Text style={styles.blockBody}>{tx.pickup_instructions}</Text> : null}
                </View>
              ) : null}

              {showMyCode && myCode ? (
                <View style={styles.codeCard}>
                  <Text style={styles.codeLabel}>Your handoff code</Text>
                  {/* One box per digit, read out one at a time. Spoken as
                      separate digits too, not as a six-figure number. */}
                  <View accessible accessibilityLabel={myCode.split('').join(' ')} style={styles.codeBoxes}>
                    {myCode.split('').map((ch, i) => (
                      <View key={i} style={styles.codeBox}>
                        <Text style={styles.codeDigit}>{ch}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={styles.codeHint}>Read this to {otherPartyName} at pickup.</Text>
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
                    {waiting?.who === 'locked' ? (
                      <Text style={styles.blockBody}>
                        You need to either complete the current transaction or withdraw from it.
                      </Text>
                    ) : null}
                    <View style={styles.buttonRow}>
                      <Button
                        label="Accept"
                        disabled={busy || waiting?.who === 'locked'}
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
                        onPress={() =>
                          run(() => apiClient.post<ToyTransaction>(`/api/toy-transactions/${id}/reject`, {}))
                        }
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
            </View>
          ) : null}

          {/* Mirrors web's toy-transaction-thread.tsx (lines 256-266): the toy
              THIS viewer walked away with, present only once the handoff is
              complete and still a draft — already listed or given away by
              the time this loads, there is nothing left to prompt. */}
          {receivedToy ? (
            <Card style={styles.block}>
              <Text style={styles.blockTitle}>Handoff complete.</Text>
              <Text style={styles.blockBody}>
                {receivedToy.name} is yours now. Add it to the toy library if you would like others to be able to
                request it.
              </Text>
              <Button
                label="Add to toy library"
                variant="accent"
                onPress={() => router.push(`/toys/${receivedToy.id}`)}
              />
            </Card>
          ) : null}

          <View accessibilityRole="list" accessibilityLabel="Conversation" style={styles.log}>
            {tx.messages.map((m) => (
              <MessageBubble
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
              variant="danger"
              disabled={busy}
              style={styles.withdraw}
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
  retry: {
    marginTop: theme.spacing(5),
    alignSelf: 'center',
    paddingHorizontal: theme.spacing(8),
  },
  scrollContent: { paddingBottom: theme.spacing(4), gap: theme.spacing(3) },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
    padding: theme.spacing(4),
  },
  toyTile: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.field,
    backgroundColor: theme.colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 2 },
  swapLine: {
    fontFamily: theme.fonts.black,
    fontSize: theme.type.body,
    color: theme.colors.text,
  },
  headerMeta: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
  },
  block: { gap: theme.spacing(2), padding: theme.spacing(4) },
  blockTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.label,
    color: theme.colors.text,
  },
  blockBody: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    lineHeight: 21,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  eyebrow: {
    fontFamily: theme.fonts.black,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.colors.ink,
  },
  costLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing(3),
  },
  costDesc: {
    flex: 1,
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.text,
  },
  costAmount: {
    fontFamily: theme.fonts.numeral,
    fontSize: theme.type.label,
    color: theme.colors.text,
  },
  payBack: {
    alignSelf: 'flex-start',
    borderRadius: theme.radii.panel,
    padding: theme.spacing(3),
    gap: 2,
  },
  payBackYou: { backgroundColor: theme.colors.honeySoft },
  payBackThem: { backgroundColor: theme.colors.mintSoft },
  payBackLabel: {
    fontFamily: theme.fonts.black,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.colors.ink,
  },
  payBackAmount: {
    fontFamily: theme.fonts.numeral,
    fontSize: theme.type.title,
    color: theme.colors.ink,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  railCard: { padding: theme.spacing(3) },
  rail: { flexDirection: 'row' },
  stage: { flex: 1 },
  stageInner: { gap: theme.spacing(1.5) },
  stageTop: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stageDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot_done: { backgroundColor: theme.colors.primary },
  dot_current: {
    backgroundColor: theme.colors.honey,
    borderWidth: 3,
    borderColor: theme.colors.honeySoft,
  },
  dot_todo: { backgroundColor: theme.colors.surfaceSunken },
  stageBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.colors.surfaceSunken,
  },
  stageBarDone: { backgroundColor: theme.colors.primary },
  stageLabel: {
    fontFamily: theme.fonts.black,
    fontSize: 11.5,
    color: theme.colors.ink,
  },
  stageLabelTodo: { color: theme.colors.muted },
  waitCard: {
    borderRadius: theme.radii.panel,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    padding: theme.spacing(4),
    gap: theme.spacing(3),
    ...theme.shadow(2),
  },
  wait_you: { backgroundColor: theme.colors.honeySoft },
  wait_them: { backgroundColor: theme.colors.surface },
  wait_locked: { backgroundColor: theme.colors.surfaceSunken },
  pickup: { gap: theme.spacing(1) },
  pickupTitle: {
    fontFamily: theme.fonts.display,
    fontSize: theme.type.heading,
    color: theme.colors.ink,
    lineHeight: 24,
  },
  codeCard: {
    alignItems: 'center',
    gap: theme.spacing(2),
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.panel,
    padding: theme.spacing(4),
  },
  codeLabel: {
    fontFamily: theme.fonts.black,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.colors.muted,
  },
  codeBoxes: { flexDirection: 'row', gap: theme.spacing(1.5) },
  codeBox: {
    width: 40,
    height: 48,
    borderRadius: theme.radii.field,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeDigit: {
    fontFamily: theme.fonts.numeral,
    fontSize: theme.type.title,
    color: theme.colors.primaryDeep,
  },
  codeHint: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  log: { gap: theme.spacing(2) },
  footer: {
    borderTopWidth: theme.border.hairline,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing(3),
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing(2),
  },
  composerField: { flex: 1 },
  composerInput: { maxHeight: 96 },
  sendButton: { paddingHorizontal: theme.spacing(4) },
  withdraw: {
    alignSelf: 'center',
    minHeight: 40,
    paddingVertical: theme.spacing(1),
  },
  actionBlock: { gap: theme.spacing(2) },
  buttonRow: { flexDirection: 'row', gap: theme.spacing(2) },
  rowButton: { flex: 1 },
  confirmedNote: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.label,
    color: theme.colors.muted,
  },
})
