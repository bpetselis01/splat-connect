// packages/mobile/components/builds/build-thread-screen.tsx
/**
 * One build: the board's #build_thread. A build IS a toy transaction (057), so
 * the polling, run() and message plumbing are exchanges/thread-screen.tsx's;
 * what differs is the subject (a guide, not a toy), the four-dot rail, and the
 * stage an exchange does not have — the maker posts a working shot and the
 * family approves it before anybody travels.
 *
 * Who may do what, and what the card says, is lib/builds.ts. This file lays it
 * out: header, rail, the one card that matters now, the conversation.
 *
 * Not drawn from the board, on purpose:
 * - "As the family / As the maker". A prototype switch; the viewer's side is
 *   read off the row.
 * - The cost panel. Mobile has no exchange-costs screen yet on any thread; the
 *   parts conversation happens in the messages until it does.
 * - "Report a problem". Mobile has no report flow to send it to.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import type { ToyTransaction, ToyTransactionDetail, ToyTransactionMessage } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { uploadFile } from '../../lib/upload'
import { supabase } from '../../lib/supabase'
import { theme } from '../../lib/theme'
import { useCapabilities } from '../../lib/capabilities'
import { buildCard, buildControls, buildRail, type RailState } from '../../lib/builds'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { MessageBubble } from '../ui/MessageBubble'
import { ErrorRow } from '../auth-screen'
import { apiMessage } from '../exchanges/thread-screen'

const POLL_MS = 10_000
const LOAD_ERROR = "Couldn't load this build."

const PICKUP_FIELDS = [
  { key: 'pickup_line1', label: 'Street address' },
  { key: 'pickup_suburb', label: 'Suburb' },
  { key: 'pickup_state', label: 'State' },
  { key: 'pickup_postcode', label: 'Postcode' },
] as const
type PickupDraft = Record<(typeof PICKUP_FIELDS)[number]['key'], string>

const DOT: Record<RailState, { bg: string; fg: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  done: { bg: theme.colors.primaryDark, fg: theme.colors.surface, icon: 'checkmark' },
  now: { bg: theme.colors.honey, fg: theme.colors.ink, icon: 'ellipse' },
  todo: { bg: theme.colors.surfaceSunken, fg: theme.colors.muted, icon: 'remove' },
  stop: { bg: theme.colors.apricot, fg: theme.colors.ink, icon: 'close' },
}

export function BuildThreadScreen({ id }: { id: string }) {
  const router = useRouter()
  const { caps } = useCapabilities()
  const [tx, setTx] = useState<ToyTransactionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState('')
  const [code, setCode] = useState('')
  const [pickup, setPickup] = useState<PickupDraft | null>(null)
  const [shotUrl, setShotUrl] = useState<string | null>(null)
  const logRef = useRef<ScrollView>(null)
  // Same guard as the exchange thread: a poll in flight when someone acted
  // answers with the row as it was before, and must not be applied.
  const generation = useRef(0)

  const load = useCallback(async () => {
    const at = generation.current
    try {
      const fresh = await apiClient.get<ToyTransactionDetail>(`/api/toy-transactions/${id}`)
      if (generation.current !== at) return
      // A toy opened at this URL belongs on the exchange thread.
      if (fresh.type !== 'build') {
        router.replace(`/exchanges/${id}`)
        return
      }
      setTx(fresh)
      setError((cur) => (cur === LOAD_ERROR ? null : cur))
    } catch (err) {
      console.error('[BuildThreadScreen] transaction fetch failed:', err)
      if (generation.current !== at) return
      setError(LOAD_ERROR)
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useFocusEffect(
    useCallback(() => {
      load()
      const timer = setInterval(load, POLL_MS)
      return () => clearInterval(timer)
    }, [load])
  )

  // The bucket is private (057) and its policy admits the two parties, so the
  // photo is signed with the viewer's own session — the same way the guide
  // PDFs are. Re-signed only when the path changes, not on every poll.
  const shotPath = tx?.working_photo_url ?? null
  useEffect(() => {
    if (!shotPath) return setShotUrl(null)
    let ignore = false
    supabase.storage
      .from('build-shots')
      .createSignedUrl(shotPath, 60 * 60)
      .then(({ data }) => {
        if (!ignore) setShotUrl(data?.signedUrl ?? null)
      })
    return () => {
      ignore = true
    }
  }, [shotPath])

  const viewerId = caps?.profile.id ?? ''
  const ledOrgIds = caps?.ledOrgs.map((o) => o.id) ?? []

  async function run(action: () => Promise<ToyTransaction>): Promise<boolean> {
    generation.current += 1
    setBusy(true)
    setError(null)
    try {
      const fresh = await action()
      setTx((cur) => (cur ? { ...cur, ...fresh } : cur))
      // The system line the API wrote alongside, and the names a claim fills in.
      void load()
      return true
    } catch (err) {
      setError(apiMessage(err, 'Something went wrong. Please try again.'))
      return false
    } finally {
      setBusy(false)
    }
  }

  const post = (path: string, body: unknown = {}) =>
    run(() => apiClient.post<ToyTransaction>(`/api/toy-transactions/${id}/${path}`, body))

  async function postShot() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      setError('Photo library access is needed to post the working shot.')
      return
    }
    const picked = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] })
    const asset = picked.canceled ? null : picked.assets?.[0]
    if (!asset) return
    await run(
      () =>
        uploadFile(
          `/api/toy-transactions/${id}/working-shot`,
          id,
          { uri: asset.uri, name: asset.fileName ?? 'working-shot.jpg', mimeType: asset.mimeType ?? 'image/jpeg' },
          null
        ) as unknown as Promise<ToyTransaction>
    )
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

  const c = buildControls(tx, viewerId, ledOrgIds)
  const otherName = c.isMaker ? tx.requester_name : tx.owner_name
  const card = buildCard(tx, viewerId, otherName, ledOrgIds)
  const rail = buildRail(tx)
  const myCode = c.isMaker ? tx.owner_code : tx.requester_code
  const nameFor = (senderId: string) => (senderId === tx.requester_id ? tx.requester_name : tx.owner_name)
  const lead =
    tx.status === 'completed'
      ? c.isMaker
        ? `You built this for ${otherName}`
        : `${otherName} built this for you`
      : tx.status === 'rejected' || tx.status === 'withdrawn'
        ? 'Nothing was built'
        : !tx.owner_id && !tx.owner_org_id
          ? c.isFamily
            ? 'Build · waiting for a maker'
            : `Build for a family in ${tx.requester_suburb ?? 'your area'}`
          : c.isMaker
            ? `Build for ${otherName}`
            : `Build · ${otherName} is making it`
  const pickupComplete = pickup !== null && PICKUP_FIELDS.every((f) => pickup[f.key].trim())

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <ScrollView
          ref={logRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Card style={styles.head}>
            <View style={styles.headTile}>
              <Ionicons name="book-outline" size={24} color={theme.colors.ink} />
            </View>
            <View style={styles.headBody}>
              <Text style={styles.headTitle}>{tx.tutorial_title ?? 'A build'}</Text>
              <Text style={styles.headLead}>{lead}</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: card.tone }]}>
              <Ionicons name={card.icon} size={11} color={theme.colors.ink} />
              <Text style={styles.statusText}>{card.kicker}</Text>
            </View>
          </Card>

          <Card style={styles.rail} accessibilityLabel="Build progress" accessible>
            {rail.map((step, i) => (
              <View key={step.label} style={styles.railStep}>
                <View style={styles.railTrack}>
                  <View style={[styles.dot, { backgroundColor: DOT[step.state].bg }, step.state === 'now' && styles.dotNow]}>
                    <Ionicons name={DOT[step.state].icon} size={step.state === 'now' ? 7 : 12} color={DOT[step.state].fg} />
                  </View>
                  {i < rail.length - 1 ? (
                    <View style={[styles.bar, step.state === 'done' && styles.barDone]} />
                  ) : null}
                </View>
                <Text style={[styles.railLabel, step.state === 'todo' && styles.railLabelTodo]} numberOfLines={1}>
                  {step.label}
                </Text>
              </View>
            ))}
          </Card>

          <View style={[styles.next, { backgroundColor: card.tone }]}>
            <View style={styles.kickerRow}>
              <Ionicons name={card.icon} size={13} color={theme.colors.ink} />
              <Text style={styles.kicker}>{card.kicker}</Text>
            </View>
            <Text style={styles.nextTitle}>{card.title}</Text>
            <Text style={styles.nextBody}>{card.body}</Text>

            {c.canClaim ? (
              <Button label="I'll build this" disabled={busy} onPress={() => post('claim')} style={styles.nextButton} />
            ) : null}

            {c.canAnswer ? (
              pickup ? (
                <View style={styles.nextStack}>
                  <Text style={styles.nextBody}>Where should they collect it? Shared with the family once you accept.</Text>
                  {PICKUP_FIELDS.map((f) => (
                    <TextField
                      key={f.key}
                      label={f.label}
                      accessibilityLabel={f.label}
                      autoComplete="off"
                      value={pickup[f.key]}
                      onChangeText={(text) => setPickup({ ...pickup, [f.key]: text })}
                    />
                  ))}
                  <Button
                    label="Take it on"
                    disabled={busy || !pickupComplete}
                    onPress={async () => {
                      if (await post('accept', pickup)) setPickup(null)
                    }}
                  />
                  <Button label="Cancel" variant="ghost" onPress={() => setPickup(null)} />
                </View>
              ) : (
                <View style={styles.buttonRow}>
                  <Button
                    label="Take it on"
                    disabled={busy}
                    style={styles.rowButton}
                    // An organisation's pickup point is fixed server-side; a
                    // person's is asked for, seeded from their saved default.
                    onPress={() =>
                      tx.owner_org_id
                        ? post('accept')
                        : setPickup({
                            pickup_line1: caps?.profile.pickup_line1 ?? '',
                            pickup_suburb: caps?.profile.pickup_suburb ?? '',
                            pickup_state: caps?.profile.pickup_state ?? '',
                            pickup_postcode: caps?.profile.pickup_postcode ?? '',
                          })
                    }
                  />
                  <Button label="Decline" variant="secondary" disabled={busy} style={styles.rowButton} onPress={() => post('reject')} />
                </View>
              )
            ) : null}

            {c.canPostShot ? (
              <Button
                label={tx.working_photo_url ? 'Replace the working shot' : 'Post the working shot'}
                variant="secondary"
                disabled={busy}
                onPress={postShot}
                style={styles.nextButton}
              />
            ) : null}

            {c.canApprove ? (
              <View style={styles.nextStack}>
                <Button label="Looks right — arrange pickup" disabled={busy} onPress={() => post('approve-work')} />
                <Button
                  label="Ask for a change"
                  variant="secondary"
                  disabled={busy}
                  // Changes are asked for in words; this starts the sentence.
                  onPress={() => setDraft((cur) => cur || 'Could you change ')}
                />
              </View>
            ) : null}

            {c.showCode && myCode ? (
              <View style={styles.codeBox}>
                <Text style={styles.codeKicker}>Your handover code</Text>
                <View accessible accessibilityLabel={`Handover code ${myCode.split('').join(' ')}`} style={styles.codeRow}>
                  {myCode.split('').map((ch, i) => (
                    <Text key={i} style={styles.codeChar}>
                      {ch}
                    </Text>
                  ))}
                </View>
                <Text style={styles.codeHint}>
                  Read this to {otherName} when the toy changes hands, and type in the code they read you.
                </Text>
                {!c.confirmed ? (
                  <>
                    <TextField
                      accessibilityLabel="Enter their code"
                      placeholder={`${otherName}'s code`}
                      inputMode="numeric"
                      value={code}
                      onChangeText={setCode}
                    />
                    <Button
                      label="Confirm handover"
                      disabled={busy || !code.trim()}
                      onPress={async () => {
                        if (await post('confirm', { code })) setCode('')
                      }}
                    />
                  </>
                ) : null}
              </View>
            ) : null}
          </View>

          {shotUrl ? (
            <View style={styles.shot}>
              <Image source={{ uri: shotUrl }} style={styles.shotImage} accessibilityLabel="The working shot" />
              <View style={styles.shotCaption}>
                <Ionicons name="checkmark-circle" size={14} color={theme.colors.success} />
                <Text style={styles.shotText}>
                  Working shot{tx.work_approved_at ? ' · approved by the family' : ''}
                </Text>
              </View>
            </View>
          ) : null}

          {tx.build_brief ? (
            <View style={styles.brief}>
              <Text style={styles.briefText}>
                <Text style={styles.briefWho}>{c.isFamily ? 'You asked' : `Family in ${tx.requester_suburb ?? 'your area'}`}: </Text>
                “{tx.build_brief}”
              </Text>
              <Text style={styles.briefFacts}>
                {[tx.child_label, tx.travel_km !== null ? `Can travel ${tx.travel_km} km` : null, tx.urgency]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
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
          {c.canMessage && (tx.owner_id || tx.owner_org_id) ? (
            <View style={styles.composer}>
              {c.canPostShot ? (
                <Pressable
                  onPress={postShot}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="Post the working shot"
                  style={styles.camera}
                >
                  <Ionicons name="camera-outline" size={20} color={theme.colors.ink} />
                </Pressable>
              ) : null}
              <View style={styles.composerField}>
                <TextField
                  accessibilityLabel="Message"
                  placeholder="Message"
                  value={draft}
                  onChangeText={setDraft}
                  multiline
                  style={styles.composerInput}
                />
              </View>
              <Button label="Send" disabled={busy || !draft.trim()} onPress={send} style={styles.sendButton} />
            </View>
          ) : null}
          {c.canWithdraw && !pickup ? (
            <Button
              label={c.isMaker ? 'Withdraw from this build' : 'Withdraw the request'}
              variant="ghost"
              disabled={busy}
              onPress={() => post('withdraw')}
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
  scrollContent: { paddingBottom: theme.spacing(4), gap: theme.spacing(3) },
  head: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), padding: theme.spacing(3) },
  headTile: {
    width: 46,
    height: 46,
    borderRadius: theme.radii.field,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headBody: { flex: 1, minWidth: 0 },
  headTitle: { fontFamily: theme.fonts.black, fontSize: 15, color: theme.colors.text },
  headLead: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: theme.radii.pill,
  },
  statusText: { fontFamily: theme.fonts.black, fontSize: 10.5, letterSpacing: 0.5, textTransform: 'uppercase', color: theme.colors.ink },
  rail: { flexDirection: 'row', gap: theme.spacing(1.5), paddingVertical: theme.spacing(3), paddingHorizontal: theme.spacing(3.5) },
  railStep: { flex: 1, gap: theme.spacing(1.5), minWidth: 0 },
  railTrack: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 22, height: 22, borderRadius: theme.radii.pill, alignItems: 'center', justifyContent: 'center' },
  dotNow: { borderWidth: 3, borderColor: theme.colors.honeySoft },
  bar: { flex: 1, height: 3, borderRadius: theme.radii.pill, backgroundColor: theme.colors.border },
  barDone: { backgroundColor: theme.colors.primaryDark },
  railLabel: { fontFamily: theme.fonts.black, fontSize: 11.5, color: theme.colors.ink },
  railLabelTodo: { color: theme.colors.muted },
  next: { padding: theme.spacing(3.5), borderRadius: theme.radii.panel, ...theme.shadow(2) },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: theme.spacing(1) },
  kicker: { fontFamily: theme.fonts.black, fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase', color: theme.colors.ink },
  nextTitle: { fontFamily: theme.fonts.display, fontSize: 17, color: theme.colors.ink, marginBottom: theme.spacing(1.5) },
  nextBody: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.ink, lineHeight: 19 },
  nextButton: { marginTop: theme.spacing(3) },
  nextStack: { gap: theme.spacing(2), marginTop: theme.spacing(3) },
  buttonRow: { flexDirection: 'row', gap: theme.spacing(2), marginTop: theme.spacing(3) },
  rowButton: { flex: 1 },
  codeBox: {
    marginTop: theme.spacing(3),
    padding: theme.spacing(3.5),
    borderRadius: theme.radii.panel,
    backgroundColor: theme.colors.surface,
    gap: theme.spacing(2),
  },
  codeKicker: {
    fontFamily: theme.fonts.black,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: theme.colors.muted,
    textAlign: 'center',
  },
  codeRow: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  codeChar: {
    width: 40,
    height: 50,
    borderRadius: 13,
    overflow: 'hidden',
    backgroundColor: theme.colors.accentLight,
    color: theme.colors.primaryDeep,
    fontFamily: theme.fonts.numeral,
    fontSize: 26,
    lineHeight: 50,
    textAlign: 'center',
  },
  codeHint: { fontFamily: theme.fonts.regular, fontSize: 12.5, color: theme.colors.muted, lineHeight: 18, textAlign: 'center' },
  shot: {
    alignSelf: 'flex-start',
    width: '78%',
    borderRadius: theme.radii.panel,
    overflow: 'hidden',
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  shotImage: { width: '100%', aspectRatio: 4 / 3, backgroundColor: theme.colors.surfaceSunken },
  shotCaption: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: theme.spacing(3), paddingVertical: theme.spacing(2) },
  shotText: { fontFamily: theme.fonts.bold, fontSize: 12, color: theme.colors.text },
  brief: { padding: theme.spacing(3), borderRadius: theme.radii.field, backgroundColor: theme.colors.surfaceSunken, gap: theme.spacing(1) },
  briefText: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, lineHeight: 19 },
  briefWho: { fontFamily: theme.fonts.black, color: theme.colors.ink },
  briefFacts: { fontFamily: theme.fonts.bold, fontSize: 12, color: theme.colors.muted },
  log: { gap: theme.spacing(2) },
  footer: { borderTopWidth: theme.border.hairline, borderTopColor: theme.colors.border, paddingTop: theme.spacing(3) },
  composer: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing(2) },
  camera: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.pill,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerField: { flex: 1 },
  composerInput: { maxHeight: 96 },
  sendButton: { paddingHorizontal: theme.spacing(4) },
})
