// packages/mobile/components/printing/job-screen.tsx
/**
 * One print job: the five-dot rail, then only the card for where it is now,
 * what it costs, and the thread.
 *
 * Both sides open this page — the family from My print requests, the printer
 * from Print for others or a notification — and the card is the only part
 * that differs: the printer's carries the next move (start, post the photo,
 * take the code), the family's says what they are waiting for. It is chosen
 * by `jobState` in lib/printing.ts, which the tests hold.
 *
 * The board's "Did it fit?" after collection and its recycling-credit lines
 * have no API behind them, so they are not drawn. The dashed "switch to the
 * printer's side" row is a prototype shortcut, not a feature.
 */
import { useCallback, useRef, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Image } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { Printer, ToyTransaction, ToyTransactionDetail, ToyTransactionMessage } from '@splat-connect/types'
import { apiMessage, formatCents, isOwnerSide, plural } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { supabase } from '../../lib/supabase'
import { useCapabilities } from '../../lib/capabilities'
import { theme } from '../../lib/theme'
import { askedLabel, jobState, JOB_LABEL, JOB_TONE, RAIL, railIndex, type JobState } from '../../lib/printing'
import { markReady, startPrint, withdrawRequest } from './actions'
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
const LOAD_ERROR = "Couldn't load this print job."
const RAIL_ICONS = ['paper-plane-outline', 'checkmark', 'print-outline', 'cube-outline', 'home-outline'] as const

type Costs = { total_cents: number }

function askedWhen(iso: string): string {
  const d = new Date(iso)
  return d.toDateString() === new Date().toDateString()
    ? 'asked today'
    : `asked ${d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`
}

export function PrintJobScreen({ id }: { id: string }) {
  const router = useRouter()
  const { caps } = useCapabilities()
  const [tx, setTx] = useState<ToyTransactionDetail | null>(null)
  const [printer, setPrinter] = useState<Printer | null>(null)
  const [costs, setCosts] = useState<Costs | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState('')
  const [code, setCode] = useState('')
  // Bumped by every write, so a poll that left before it cannot land after it
  // and put the old state back under somebody's thumb (thread-screen.tsx).
  const generation = useRef(0)

  const load = useCallback(async () => {
    const at = generation.current
    try {
      const fresh = await apiClient.get<ToyTransactionDetail>(`/api/toy-transactions/${id}`)
      if (generation.current !== at) return
      setTx(fresh)
      setError((cur) => (cur === LOAD_ERROR ? null : cur))
      // The side panels are best-effort: a job with no rate or no cost line
      // still reads correctly without them.
      if (fresh.printer_id) {
        apiClient.get<Printer>(`/api/printers/${fresh.printer_id}`).then(setPrinter, () => {})
      }
      apiClient.get<Costs>(`/api/exchange-costs/${id}`).then(setCosts, () => {})
      // A storage path in the private print-shots bucket, signed in-process
      // the way detail-screen.tsx signs a guide's PDF.
      if (fresh.ready_photo_url) {
        supabase.storage
          .from('print-shots')
          .createSignedUrl(fresh.ready_photo_url, 600)
          .then(({ data }) => setPhotoUrl(data?.signedUrl ?? null), () => {})
      }
    } catch (err) {
      console.error('[PrintJobScreen] fetch failed:', err)
      if (generation.current === at) setError(LOAD_ERROR)
    } finally {
      setLoading(false)
    }
  }, [id])

  useFocusEffect(
    useCallback(() => {
      load()
      const timer = setInterval(load, POLL_MS)
      return () => clearInterval(timer)
    }, [load])
  )

  async function run(action: () => Promise<ToyTransaction | null | void>): Promise<boolean> {
    generation.current += 1
    setBusy(true)
    setError(null)
    try {
      const fresh = await action()
      if (fresh) setTx((cur) => (cur ? { ...cur, ...fresh } : cur))
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
    const sent = await run(async () => {
      const created = await apiClient.post<ToyTransactionMessage>(`/api/toy-transactions/${id}/messages`, { body })
      setTx((cur) => (cur ? { ...cur, messages: [...cur.messages, created] } : cur))
    })
    if (sent) setDraft('')
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
        <EmptyState icon="cloud-offline-outline" title={LOAD_ERROR} hint="Check your connection and try again." />
      </Screen>
    )
  }

  const viewerId = caps?.profile.id ?? ''
  const isPrinter = isOwnerSide(tx, viewerId, caps?.ledOrgs.map((o) => o.id) ?? [])
  const other = isPrinter ? tx.requester_name : tx.owner_name
  const state = jobState(tx)
  const at = railIndex(state)
  const live = tx.status === 'requested' || tx.status === 'accepted'
  const partCount = tx.print_files.reduce((n, f) => n + f.quantity, 0)
  const nameFor = (senderId: string) => (senderId === tx.requester_id ? tx.requester_name : tx.owner_name)

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.head}>
            <View style={styles.glyph}>
              <Ionicons name="cube-outline" size={24} color={theme.colors.ink} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.title}>{tx.tutorial_title ?? 'A print job'}</Text>
              <Text style={styles.meta}>
                {plural(partCount, 'part')} · {askedWhen(tx.created_at)}
              </Text>
            </View>
            <Badge status={JOB_TONE[state]} label={JOB_LABEL[state]} />
          </View>

          <Card style={styles.rail} accessibilityRole="progressbar" accessibilityLabel={`Progress: ${JOB_LABEL[state]}`}>
            {RAIL.map((label, i) => {
              const done = i < at
              const current = i === at
              return (
                <View key={label} style={styles.railStep}>
                  <View style={[styles.dot, done && styles.dotDone, current && styles.dotCurrent]}>
                    <Ionicons
                      name={done ? 'checkmark' : RAIL_ICONS[i]}
                      size={14}
                      color={done || current ? theme.colors.surface : theme.colors.muted}
                    />
                  </View>
                  <Text style={[styles.railLabel, current && styles.railLabelCurrent]}>{label}</Text>
                </View>
              )
            })}
          </Card>

          <StateCard
            tx={tx}
            state={state}
            isPrinter={isPrinter}
            other={other}
            photoUrl={photoUrl}
            busy={busy}
            code={code}
            setCode={setCode}
            onStart={() => run(() => startPrint(id))}
            onReady={() => run(() => markReady(id))}
            onConfirm={async () => {
              if (await run(() => apiClient.post<ToyTransaction>(`/api/toy-transactions/${id}/confirm`, { code }))) setCode('')
            }}
            onAnswer={() => router.push('/print-for-others')}
          />

          {!isPrinter && state !== 'declined' && state !== 'withdrawn' ? (
            <Card style={styles.block}>
              <Text style={styles.eyebrow}>What this print costs you</Text>
              <Text style={styles.body}>
                {tx.owner_name} gives the time and the machine free. These are their standard rates, in their own words.
              </Text>
              <Text style={styles.strong}>
                {printer?.filament_cents_per_g == null
                  ? 'Free · parts only'
                  : `About ${formatCents(printer.filament_cents_per_g)} / g of filament, settled between you`}
              </Text>
              {printer?.rate_note ? <Text style={styles.body}>“{printer.rate_note}”</Text> : null}
              {costs && costs.total_cents > 0 ? (
                <View style={styles.payBack}>
                  <Text style={styles.eyebrow}>You pay back</Text>
                  <Text style={styles.money}>{formatCents(costs.total_cents)}</Text>
                </View>
              ) : null}
            </Card>
          ) : null}

          <Text style={styles.eyebrow}>Thread</Text>
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
          {live ? (
            <View style={styles.composer}>
              <View style={styles.flex}>
                <TextField
                  accessibilityLabel={`Message ${other}`}
                  placeholder="Message"
                  value={draft}
                  onChangeText={setDraft}
                  multiline
                  style={styles.composerInput}
                />
              </View>
              <Button label="Send" disabled={busy || !draft.trim()} onPress={send} style={styles.send} />
            </View>
          ) : null}
          {live && !isPrinter ? (
            <Button
              label="Withdraw request"
              variant="ghost"
              disabled={busy}
              onPress={async () => {
                if (await run(() => withdrawRequest(tx))) load()
              }}
            />
          ) : null}
        </View>
      </Screen>
    </KeyboardAvoidingView>
  )
}

/**
 * The one card for the current state. Copy follows web's print-next-step.tsx
 * where the board does not say otherwise.
 */
function StateCard({
  tx,
  state,
  isPrinter,
  other,
  photoUrl,
  busy,
  code,
  setCode,
  onStart,
  onReady,
  onConfirm,
  onAnswer,
}: {
  tx: ToyTransactionDetail
  state: JobState
  isPrinter: boolean
  other: string
  photoUrl: string | null
  busy: boolean
  code: string
  setCode: (c: string) => void
  onStart: () => void
  onReady: () => void
  onConfirm: () => void
  onAnswer: () => void
}) {
  const machine = tx.printer ? `On ${tx.printer.name}` : null

  if (state === 'asked') {
    return isPrinter ? (
      <Card style={[styles.block, styles.honey]}>
        <Text style={styles.strong}>Take the job, or decline</Text>
        <Text style={styles.body}>
          Check the parts fit the bed and the material is loaded. Declining needs a reason — the family sees it.
        </Text>
        <Button label="Answer in Print for others" onPress={onAnswer} />
      </Card>
    ) : (
      <Card style={[styles.block, styles.honey, styles.rowCard]}>
        <Ionicons name="flash" size={22} color={theme.colors.honey} />
        <Text style={[styles.body, styles.flex, styles.ink]}>
          <Text style={styles.strong}>{askedLabel(tx.print_group_size ?? 1)}</Text> The first to accept takes it; you
          will get a notification.
        </Text>
      </Card>
    )
  }

  if (state === 'accepted' || state === 'printing') {
    const printing = state === 'printing'
    return (
      <Card style={styles.block}>
        <Text style={styles.strong}>{isPrinter ? tx.requester_name : tx.owner_name}</Text>
        {machine ? <Text style={styles.meta}>{machine}</Text> : null}
        <Text style={styles.body}>
          {isPrinter
            ? printing
              ? 'Post a photo when it comes off. The photo is what lets the family know there is something to collect.'
              : 'Start it when the bed is free. Marking it started tells the family it is under way.'
            : printing
              ? 'It is on the bed. You will get a photo when it comes off, and the pickup details with it.'
              : 'They have taken it on. You will hear when it goes on the bed.'}
        </Text>
        {isPrinter ? (
          <Button
            label={printing ? 'Mark ready for pickup' : 'Started printing'}
            loading={busy}
            onPress={printing ? onReady : onStart}
          />
        ) : null}
      </Card>
    )
  }

  if (state === 'ready') {
    const myCode = isPrinter ? tx.owner_code : tx.requester_code
    const confirmed = isPrinter ? tx.owner_confirmed_at : tx.requester_confirmed_at
    const pickup = [tx.pickup_line1, tx.pickup_suburb, tx.pickup_state, tx.pickup_postcode].filter(Boolean).join(', ')
    return (
      <Card style={[styles.block, styles.mint]}>
        <View style={styles.rowCard}>
          <Ionicons name="cube" size={22} color={theme.colors.ink} />
          <Text style={styles.strong}>{isPrinter ? 'Waiting for pickup' : 'Ready for pickup'}</Text>
        </View>
        {!isPrinter ? (
          <Text style={[styles.body, styles.ink]}>
            {tx.print_delivery === 'post'
              ? `${tx.owner_name} is posting it. Settle the filament and postage with them the way they asked.`
              : `${pickup || 'Agree where in the thread'}. Settle the filament with them the way they asked — it is on the cost panel below.`}
          </Text>
        ) : (
          <Text style={[styles.body, styles.ink]}>The requester has your pickup details and a photo.</Text>
        )}
        {!isPrinter && tx.pickup_instructions ? <Text style={[styles.body, styles.ink]}>{tx.pickup_instructions}</Text> : null}
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.photo} accessibilityLabel="Photo of the finished parts" />
        ) : null}
        {myCode ? (
          <Text style={[styles.body, styles.ink]}>
            Your code: <Text style={styles.code}>{myCode}</Text> — read it to {other} at the handover.
          </Text>
        ) : null}
        {confirmed ? (
          <Text style={styles.strong}>Waiting on {other} to confirm</Text>
        ) : (
          <>
            <TextField
              label="Their code"
              accessibilityLabel="Their code"
              hint={`The six digits ${other} reads out when the parts change hands.`}
              inputMode="numeric"
              value={code}
              onChangeText={setCode}
            />
            <Button
              label={isPrinter ? 'Confirm handover' : 'I have collected it'}
              disabled={busy || !code.trim()}
              onPress={onConfirm}
            />
          </>
        )}
      </Card>
    )
  }

  if (state === 'collected') {
    return (
      <Card style={[styles.block, styles.mint]}>
        <Text style={styles.strong}>Collected</Text>
        <Text style={[styles.body, styles.ink]}>Both of you confirmed. Closed and kept as a record.</Text>
      </Card>
    )
  }

  return (
    <Card style={[styles.block, styles.sunken]}>
      <Text style={styles.strong}>{state === 'declined' ? `${tx.owner_name} could not take it` : 'This job was withdrawn'}</Text>
      <Text style={styles.body}>
        {state === 'declined' && tx.decline_reason
          ? `${tx.decline_reason} — another printer may be able to.`
          : 'Nothing was printed. Another printer may be able to take it.'}
      </Text>
    </Card>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: theme.spacing(4), gap: theme.spacing(4) },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing(3) },
  glyph: {
    width: 52,
    height: 52,
    borderRadius: theme.radii.panel,
    backgroundColor: theme.colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: theme.fonts.display, fontSize: 22, color: theme.colors.text, lineHeight: 26 },
  meta: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, marginTop: 2 },
  rail: { flexDirection: 'row', justifyContent: 'space-between', padding: theme.spacing(4) },
  railStep: { flex: 1, alignItems: 'center', gap: 6 },
  dot: {
    width: 26,
    height: 26,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: theme.colors.success },
  dotCurrent: { backgroundColor: theme.colors.primaryDark },
  railLabel: { fontFamily: theme.fonts.bold, fontSize: 11, color: theme.colors.muted, textAlign: 'center' },
  railLabelCurrent: { fontFamily: theme.fonts.black, color: theme.colors.ink },
  block: { gap: theme.spacing(2), padding: theme.spacing(4) },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3) },
  honey: { backgroundColor: theme.colors.honeySoft },
  mint: { backgroundColor: theme.colors.mintSoft },
  sunken: { backgroundColor: theme.colors.surfaceSunken },
  eyebrow: {
    fontFamily: theme.fonts.black,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: theme.colors.muted,
  },
  body: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, lineHeight: 21 },
  ink: { color: theme.colors.ink },
  strong: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  payBack: {
    alignSelf: 'flex-start',
    padding: theme.spacing(3),
    borderRadius: theme.radii.field,
    backgroundColor: theme.colors.honeySoft,
  },
  money: { fontFamily: theme.fonts.numeral, fontSize: 22, color: theme.colors.ink },
  code: { fontFamily: theme.fonts.numeral, fontSize: theme.type.heading, color: theme.colors.primaryDeep },
  photo: { height: 140, borderRadius: theme.radii.field, backgroundColor: theme.colors.surface },
  log: { gap: theme.spacing(2) },
  footer: {
    borderTopWidth: theme.border.hairline,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing(3),
  },
  composer: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing(2) },
  composerInput: { maxHeight: 96 },
  send: { paddingHorizontal: theme.spacing(4) },
})
