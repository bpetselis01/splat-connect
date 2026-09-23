// packages/mobile/components/challenges/detail-screen.tsx
// The brief a challenge recruits with: what the problem is, who is on it, and
// the one control that puts you on it too.
//
// Reads GET /api/public/challenges/:id — anonymous, the same endpoint web's
// app/get-involved/design-challenges/[id]/page.tsx uses, and it deliberately
// never returns `messages`: the brief is public, the conversation is not.
// Join/leave write to /api/ideas (the authenticated mount of
// packages/api/src/routes/toy-ideas.ts — note the path, it is not
// /api/toy-ideas).
//
// Related files:
// - packages/api/src/routes/public.ts: GET /api/public/challenges/:id
// - packages/api/src/routes/toy-ideas.ts: join / leave / messages
// - packages/web/components/challenge-thread.tsx: the copy below is its copy
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  Alert,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { challengeHistory, challengePill, challengeStats, shortDate } from './challenge-status'
import type { ToyIdeaDetail, ToyIdeaMessage, ContactPref } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { useSaves } from '../../lib/saves'
import { useCapabilities } from '../../lib/capabilities'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Skeleton } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { SaveButton } from '../ui/SaveButton'
import { TextField } from '../ui/TextField'
import { MessageBubble } from '../ui/MessageBubble'

// Same cadence as the exchange thread. Web runs this conversation on a
// realtime subscription; mobile polls, the Phase-3 ruling repeated.
const POLL_MS = 10_000

// Same three labels web's [id]/page.tsx renders, for the same field.
const CONTACT_PREF_LABELS: Record<ContactPref, string> = {
  clarification: 'Clarification',
  co_design: 'Co-design',
  user_testing: 'User testing',
}

type Tab = 'status' | 'brief' | 'constraints' | 'makers'
// The conversation lives under Makers: it is the makers' thread.
const TABS: { id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'status', label: 'Status', icon: 'pulse-outline' },
  { id: 'brief', label: 'Brief', icon: 'document-text-outline' },
  { id: 'constraints', label: 'Constraints', icon: 'alert-circle-outline' },
  { id: 'makers', label: 'Makers', icon: 'people-outline' },
]

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  )
}

/** A static pill. Chip is a toggle — these are read-only facts, not filters. */
function Tag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{label}</Text>
    </View>
  )
}

export function ChallengeDetailScreen({ id }: { id: string }) {
  const router = useRouter()
  const saves = useSaves()
  const { caps } = useCapabilities()
  const [challenge, setChallenge] = useState<ToyIdeaDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ToyIdeaMessage[]>([])
  const [draft, setDraft] = useState('')
  const logRef = useRef<ScrollView>(null)
  // Bumped by every write. A poll already in flight when a message was posted
  // answers with the thread as it was BEFORE it, and applying that would drop
  // the message back off the screen until the next tick.
  const generation = useRef(0)
  // Join and leave both refetch the brief rather than patching state: the
  // participants list is the server's answer to "am I in", and a system
  // message lands beside it that Task 5's thread will want anyway.
  const [reloadKey, setReloadKey] = useState(0)
  const [tab, setTab] = useState<Tab>('status')

  useEffect(() => {
    let ignore = false
    apiClient
      .get<ToyIdeaDetail>(`/api/public/challenges/${id}`)
      .then((data) => {
        if (!ignore) setChallenge(data)
      })
      // No separate error flag: having a brief or not is the whole question,
      // and a join/leave refetch that fails must leave the brief on screen
      // rather than replacing a loaded challenge with "couldn't load".
      .catch(() => {})
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [id, reloadKey])

  const viewerId = caps?.profile.id ?? null
  const isAuthor = viewerId !== null && challenge?.author_id === viewerId
  const joined = viewerId !== null && !!challenge?.participants.some((p) => p.profile_id === viewerId)
  const open = challenge?.status === 'challenge'
  // A question (078): answered in its thread, and the asker marks the reply
  // that helped. Never graduates, so "Solved" never applies to it.
  const question = challenge?.kind === 'question'
  const answerId = challenge?.answer_message_id ?? null
  // The GET returns an empty array to a non-participant rather than a 403
  // (RLS, see the route's own comment), so "no messages" and "not allowed"
  // look identical on the wire — the gate has to be decided here, from the
  // brief, or a stranger sees an empty conversation instead of the invitation.
  const canRead = joined || isAuthor === true

  const loadMessages = useCallback(async () => {
    const at = generation.current
    try {
      const fresh = await apiClient.get<ToyIdeaMessage[]>(`/api/ideas/${id}/messages`)
      if (generation.current !== at) return
      setMessages(fresh)
    } catch (err) {
      // Silent: the brief is still on screen and the next tick retries. A
      // banner on every dropped poll would cry wolf on a flaky train.
      console.error('[ChallengeDetailScreen] message fetch failed:', err)
    }
  }, [id])

  // Polls only while focused and only for someone entitled to read, so a
  // backgrounded screen is not still talking and a stranger never asks.
  useFocusEffect(
    useCallback(() => {
      if (!canRead) return
      void loadMessages()
      const timer = setInterval(() => void loadMessages(), POLL_MS)
      return () => clearInterval(timer)
    }, [canRead, loadMessages])
  )

  async function send() {
    const body = draft.trim()
    if (!body) return
    generation.current += 1
    setBusy(true)
    setActionError(null)
    try {
      const created = await apiClient.post<ToyIdeaMessage>(`/api/ideas/${id}/messages`, { body })
      setDraft('')
      // Appended rather than refetched: the POST already returns the created
      // row, and the next poll replaces the array from the server anyway.
      setMessages((cur) => [...cur, created])
    } catch {
      // The draft is deliberately left in the composer — retyping a lost
      // message is the worst thing a failed send can ask of someone.
      setActionError('Could not send that message. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function join() {
    setBusy(true)
    setActionError(null)
    try {
      await apiClient.post(`/api/ideas/${id}/join`, {})
      setReloadKey((k) => k + 1)
    } catch {
      setActionError('Could not join this challenge. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function leave() {
    setBusy(true)
    setActionError(null)
    try {
      // Leaving and being removed are the same route; the profileId is what
      // separates them, and self-leave is the only one this screen offers.
      await apiClient.delete(`/api/ideas/${id}/participants/${viewerId}`)
      setReloadKey((k) => k + 1)
    } catch {
      setActionError('Could not leave this challenge. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  // POST /api/ideas/:id/answer — the API holds it to the asker and to
  // questions; null clears. Refetches the brief, which carries the mark.
  async function markAnswer(messageId: string | null) {
    setBusy(true)
    setActionError(null)
    try {
      await apiClient.post(`/api/ideas/${id}/answer`, { message_id: messageId })
      setReloadKey((k) => k + 1)
    } catch {
      setActionError('Could not mark the answer. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  function confirmLeave() {
    Alert.alert('Leave this challenge?', 'You will stop taking part in its conversation.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => void leave() },
    ])
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <Skeleton width="70%" height={24} />
        <Skeleton width="90%" height={14} />
        <Skeleton width="100%" height={120} />
      </View>
    )
  }
  if (!challenge) {
    return (
      <View style={styles.screen}>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load this challenge."
          hint="It may have been withdrawn, or your connection dropped."
        />
      </View>
    )
  }

  const nameFor = (senderId: string) => {
    if (senderId === challenge.author_id) return challenge.author_name ?? 'Someone'
    // Someone who has left keeps their messages but loses their participant
    // row, so there is genuinely no name left to show for them.
    return challenge.participants.find((p) => p.profile_id === senderId)?.name ?? 'Someone'
  }

  const pill = challengePill(challenge)
  const stats = challengeStats(challenge, new Date())
  const history = challengeHistory(challenge)
  const makers = challenge.maker_count ?? challenge.participants.length
  const headline =
    challenge.status === 'graduated'
      ? { title: 'Solved — it became a guide', body: 'The write-up went through review and is in Guides now.' }
      : question
        ? answerId
          ? { title: 'Answered', body: 'The asker marked the reply that helped. The thread stays open to read.' }
          : { title: 'Open, waiting for an answer', body: 'Anyone who joins can answer in the thread.' }
        : makers > 0
          ? { title: 'Open, and makers are on it', body: 'Anyone can read the brief; makers who join can post in the thread.' }
          : { title: 'Open, waiting for a maker', body: 'Anyone can read the brief; the first maker to join starts the thread.' }

  return (
    // `padding` shrinks Screen's flex:1 child by the keyboard's height on iOS,
    // lifting the composer above it; Android resizes at the OS level already.
    // Same posture, and the same header-height caveat, as thread-screen.tsx.
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Screen>
      <ScrollView
        ref={logRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        onContentSizeChange={() => canRead && tab === 'makers' && logRef.current?.scrollToEnd({ animated: false })}
      >
        <View style={styles.statusLine}>
          <Badge status={pill.status} label={pill.label} />
          <Text style={styles.meta}>
            {`Published ${shortDate(challenge.created_at)} · ${challenge.author_name ?? 'anonymous'}`}
          </Text>
        </View>
        <Text style={styles.title}>{challenge.title}</Text>

        {/*
          The one control, above everything, as on the board. The gate copy is
          web's challenge-thread.tsx verbatim, so the two clients say the same
          thing to the same reader.
        */}
        <View style={styles.actionRow}>
          <View style={styles.actionMain}>
            {viewerId === null ? (
              <Text style={styles.quiet}>Sign in to see the conversation and join this challenge.</Text>
            ) : joined ? (
              <View style={styles.joinedRow}>
                <Text style={styles.joinedText}>✓ You joined</Text>
                <Button label="Leave" variant="danger" disabled={busy} onPress={confirmLeave} />
              </View>
            ) : isAuthor ? (
              // The author is never a participant row (038's insert policy refuses
              // it), so they get neither control — the thread is theirs by
              // authorship, not by joining.
              <Text style={styles.quiet}>This is your challenge.</Text>
            ) : open ? (
              <Button
                label={question ? 'Join to answer' : 'Join this challenge'}
                loading={busy}
                onPress={() => void join()}
              />
            ) : (
              <Text style={styles.quiet}>
                This challenge has moved on to write-up, so joining is no longer open.
              </Text>
            )}
          </View>
          <SaveButton slug="challenges" id={challenge.id} saves={saves} />
        </View>
        {viewerId !== null && !joined && !isAuthor && open ? (
          <Text style={styles.gateHint}>Join this challenge to read and take part in the conversation.</Text>
        ) : null}

        {actionError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {actionError}
          </Text>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityRole="tablist"
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabs}
        >
          {TABS.map((t) => (
            <Pressable
              key={t.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t.id }}
              onPress={() => setTab(t.id)}
              style={[styles.tab, tab === t.id && styles.tabOn]}
            >
              <Ionicons name={t.icon} size={15} color={theme.colors.ink} />
              <Text style={styles.tabText}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {tab === 'status' ? (
          <Card style={styles.panel}>
            <View style={styles.headline}>
              <Text style={styles.headlineTitle}>{headline.title}</Text>
              <Text style={styles.quiet}>{headline.body}</Text>
            </View>
            <View style={styles.stats}>
              {stats.map((s) => (
                <View key={s.label} style={styles.stat}>
                  <Text style={styles.statN}>{s.n}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
            {/* The list shape has no tutorial_id, so this is the only place the
                guide a solved challenge became can be linked from. */}
            {challenge.tutorial_id ? (
              <Button
                label="Read the guide"
                variant="secondary"
                onPress={() => router.push(`/guides/${challenge.tutorial_id}`)}
              />
            ) : null}
            <Text style={styles.panelTitle}>History</Text>
            <View accessibilityRole="list">
              {history.map((e, i) => (
                <View key={e.title} style={styles.event}>
                  <View style={styles.eventRail}>
                    <View style={styles.eventDot} />
                    {i < history.length - 1 ? <View style={styles.eventLine} /> : null}
                  </View>
                  <View style={styles.eventText}>
                    <Text style={styles.eventTitle}>{e.title}</Text>
                    {e.date ? <Text style={styles.eventDate}>{e.date}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        {tab === 'brief' ? (
          <Card style={styles.panel}>
            <Text style={styles.summary}>{challenge.summary}</Text>
            <Field label="The problem" value={challenge.description} />
          </Card>
        ) : null}

        {tab === 'constraints' ? (
          <Card style={styles.panel}>
            <Field label="Intended use" value={challenge.intended_use} />
            <Field label="Who it's for" value={challenge.primary_user} />
          </Card>
        ) : null}

        {tab === 'makers' ? (
          <Card style={styles.panel}>
            {challenge.participants.length === 0 ? (
              <Text style={styles.quiet}>Nobody has joined yet.</Text>
            ) : (
              <View style={styles.tagRow}>
                {challenge.participants.map((p) => (
                  <Tag key={p.profile_id} label={p.name ?? 'Someone'} />
                ))}
              </View>
            )}
            {challenge.contact_prefs.length > 0 ? (
              <View>
                <Text style={styles.blockTitle}>The author is happy to help with</Text>
                <View style={styles.tagRow}>
                  {challenge.contact_prefs.map((pref) => (
                    <Tag key={pref} label={CONTACT_PREF_LABELS[pref]} />
                  ))}
                </View>
              </View>
            ) : null}
          </Card>
        ) : null}

        {tab === 'makers' && canRead ? (
          <View accessibilityRole="list" accessibilityLabel="Conversation" style={styles.log}>
            {messages.length === 0 ? (
              <Text style={styles.quiet}>No messages yet. Say what you are trying.</Text>
            ) : (
              messages.map((m) => {
                const bubble = (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    mine={m.sender_id === viewerId && m.kind === 'user'}
                    senderName={nameFor(m.sender_id)}
                  />
                )
                if (!question) return bubble
                if (m.id === answerId) {
                  return (
                    <View key={m.id} style={styles.answer}>
                      <Text style={styles.answerLabel}>The answer · marked by the asker</Text>
                      {bubble}
                      {isAuthor ? (
                        <Button
                          label="Unmark"
                          variant="secondary"
                          disabled={busy}
                          onPress={() => void markAnswer(null)}
                          style={styles.markButton}
                        />
                      ) : null}
                    </View>
                  )
                }
                // Only the asker marks, and never their own message — the
                // API refuses both; this just does not offer them.
                if (isAuthor && m.kind === 'user' && m.sender_id !== challenge.author_id) {
                  return (
                    <View key={m.id}>
                      {bubble}
                      <Button
                        label="Mark as the answer"
                        variant="secondary"
                        disabled={busy}
                        onPress={() => void markAnswer(m.id)}
                        style={styles.markButton}
                      />
                    </View>
                  )
                }
                return bubble
              })
            )}
          </View>
        ) : null}
      </ScrollView>

      {canRead && tab === 'makers' ? (
        <View style={styles.footer}>
          <View style={styles.composer}>
            {/* TextField owns its own outer wrapper, so the flex that makes the
                input take the row's spare width goes on a view around it. */}
            <View style={styles.composerField}>
              <TextField
                accessibilityLabel="Message this challenge"
                placeholder="Message this challenge…"
                value={draft}
                onChangeText={setDraft}
                multiline
                style={styles.composerInput}
              />
            </View>
            <Button
              label="Send"
              disabled={busy || !draft.trim()}
              onPress={() => void send()}
              style={styles.sendButton}
            />
          </View>
        </View>
      ) : null}
    </Screen>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: theme.colors.background },
  loading: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(4), gap: theme.spacing(3) },
  content: { paddingBottom: theme.spacing(6), gap: theme.spacing(3) },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  meta: { flex: 1, fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.muted },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.type.title,
    color: theme.colors.text,
    lineHeight: 29,
  },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  actionMain: { flex: 1 },
  gateHint: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted },
  tabsScroll: { flexGrow: 0 },
  tabs: {
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surfaceSunken,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 36,
    paddingHorizontal: theme.spacing(3),
    borderRadius: theme.radii.pill,
  },
  tabOn: { backgroundColor: theme.colors.surface, ...theme.shadow(1) },
  tabText: { fontFamily: theme.fonts.black, fontSize: 12.5, color: theme.colors.ink },
  panel: { gap: theme.spacing(3), padding: theme.spacing(4) },
  panelTitle: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  headline: {
    gap: theme.spacing(1),
    padding: theme.spacing(4),
    borderRadius: theme.radii.panel,
    backgroundColor: theme.colors.mintSoft,
  },
  headlineTitle: { fontFamily: theme.fonts.display, fontSize: theme.type.body, color: theme.colors.ink },
  stats: { flexDirection: 'row', gap: theme.spacing(2) },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing(3),
    borderRadius: theme.radii.field,
    backgroundColor: theme.colors.surfaceSunken,
    gap: 2,
  },
  statN: { fontFamily: theme.fonts.display, fontSize: theme.type.heading, color: theme.colors.ink },
  statLabel: { fontFamily: theme.fonts.bold, fontSize: 11, color: theme.colors.muted },
  event: { flexDirection: 'row', gap: theme.spacing(3) },
  eventRail: { alignItems: 'center', width: 16 },
  eventDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4, backgroundColor: theme.colors.accentLight },
  eventLine: { width: 2, flex: 1, backgroundColor: theme.colors.border },
  eventText: { flex: 1, paddingBottom: theme.spacing(3) },
  eventTitle: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  eventDate: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted },
  summary: {
    fontFamily: theme.fonts.semiBold,
    fontSize: theme.type.label,
    color: theme.colors.text,
    lineHeight: 22,
  },
  field: {},
  fieldLabel: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: theme.spacing(1),
  },
  fieldValue: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.text,
    lineHeight: 21,
  },
  blockTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.label,
    color: theme.colors.text,
    marginBottom: theme.spacing(2),
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  tag: {
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(1),
  },
  tagText: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.text },
  quiet: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    lineHeight: 21,
  },
  error: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.danger,
  },
  joinedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  joinedText: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.primaryDeep },
  log: { gap: theme.spacing(2) },
  answer: {
    backgroundColor: theme.colors.tone.mint.bg,
    borderRadius: theme.radii.field,
    padding: theme.spacing(2),
    gap: theme.spacing(1),
  },
  answerLabel: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.caption,
    color: theme.colors.tone.mint.fg,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  markButton: { alignSelf: 'flex-start', paddingVertical: theme.spacing(1), paddingHorizontal: theme.spacing(3) },
  footer: {
    borderTopWidth: theme.border.hairline,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing(3),
  },
  composer: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing(2) },
  composerField: { flex: 1 },
  composerInput: { maxHeight: 96 },
  sendButton: { paddingHorizontal: theme.spacing(5) },
})
