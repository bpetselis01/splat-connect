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
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
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
        onContentSizeChange={() => canRead && logRef.current?.scrollToEnd({ animated: false })}
      >
        <View style={styles.titleRow}>
          <Text style={styles.title}>{challenge.title}</Text>
          <SaveButton slug="challenges" id={challenge.id} saves={saves} />
        </View>

        <View style={styles.badgeRow}>
          <Badge status={challenge.status} label={open ? 'Open challenge' : 'Solved'} />
        </View>

        <Text style={styles.summary}>{challenge.summary}</Text>
        {challenge.author_name ? (
          <Text style={styles.byline}>{`Posted by ${challenge.author_name}`}</Text>
        ) : null}

        {/* The list shape has no tutorial_id, so this is the only place the
            guide a solved challenge became can be linked from. */}
        {challenge.tutorial_id ? (
          <Button
            label="Read the guide"
            variant="secondary"
            onPress={() => router.push(`/guides/${challenge.tutorial_id}`)}
            style={styles.guideButton}
          />
        ) : null}

        <Card style={styles.brief}>
          <Field label="The problem" value={challenge.description} />
          <Field label="Intended use" value={challenge.intended_use} />
          <Field label="Who it's for" value={challenge.primary_user} />
        </Card>

        {challenge.contact_prefs.length > 0 ? (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>The author is happy to help with</Text>
            <View style={styles.tagRow}>
              {challenge.contact_prefs.map((pref) => (
                <Tag key={pref} label={CONTACT_PREF_LABELS[pref]} />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Participants</Text>
          {challenge.participants.length === 0 ? (
            <Text style={styles.quiet}>Nobody has joined yet.</Text>
          ) : (
            <View style={styles.tagRow}>
              {challenge.participants.map((p) => (
                <Tag key={p.profile_id} label={p.name ?? 'Someone'} />
              ))}
            </View>
          )}
        </View>

        {actionError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {actionError}
          </Text>
        ) : null}

        {/*
          The gate copy is web's challenge-thread.tsx verbatim, so the two
          clients say the same thing to the same reader.
        */}
        {viewerId === null ? (
          <Text style={styles.quiet}>Sign in to see the conversation and join this challenge.</Text>
        ) : joined ? (
          <View style={styles.joinedRow}>
            <Text style={styles.joinedText}>✓ You joined</Text>
            <Button label="Leave" variant="danger" disabled={busy} onPress={confirmLeave} />
          </View>
        ) : isAuthor ? (
          // The author is never a participant row (038's insert policy refuses
          // it), so they get neither control — the thread below is theirs by
          // authorship, not by joining.
          <Text style={styles.quiet}>This is your challenge.</Text>
        ) : open ? (
          <View style={styles.gate}>
            <Text style={styles.quiet}>
              Join this challenge to read and take part in the conversation.
            </Text>
            <Button
              label="Join this challenge"
              variant="accent"
              loading={busy}
              onPress={() => void join()}
              style={styles.joinButton}
            />
          </View>
        ) : (
          <Text style={styles.quiet}>
            This challenge has moved on to write-up, so joining is no longer open.
          </Text>
        )}

        {canRead ? (
          <View accessibilityRole="list" accessibilityLabel="Conversation" style={styles.log}>
            {messages.length === 0 ? (
              <Text style={styles.quiet}>No messages yet. Say what you are trying.</Text>
            ) : (
              messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  mine={m.sender_id === viewerId && m.kind === 'user'}
                  senderName={nameFor(m.sender_id)}
                />
              ))
            )}
          </View>
        ) : null}
      </ScrollView>

      {canRead ? (
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
  content: { paddingBottom: theme.spacing(6) },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing(2) },
  title: {
    flex: 1,
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.title,
    color: theme.colors.text,
    lineHeight: 30,
  },
  badgeRow: { flexDirection: 'row', marginTop: theme.spacing(2) },
  summary: {
    fontFamily: theme.fonts.semiBold,
    fontSize: theme.type.label,
    color: theme.colors.text,
    lineHeight: 22,
    marginTop: theme.spacing(3),
  },
  byline: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    marginTop: theme.spacing(1),
  },
  guideButton: { alignSelf: 'flex-start', marginTop: theme.spacing(3) },
  brief: { marginTop: theme.spacing(4), gap: theme.spacing(3) },
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
  block: { marginTop: theme.spacing(5) },
  blockTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.label,
    color: theme.colors.text,
    marginBottom: theme.spacing(2),
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  tag: {
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing(2),
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
    marginTop: theme.spacing(4),
  },
  gate: { marginTop: theme.spacing(5) },
  joinButton: { alignSelf: 'flex-start', marginTop: theme.spacing(3) },
  joinedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing(5),
  },
  joinedText: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.primaryDeep },
  log: { gap: theme.spacing(2), marginTop: theme.spacing(5) },
  footer: {
    borderTopWidth: theme.border.thin,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing(3),
  },
  composer: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing(2) },
  composerField: { flex: 1 },
  composerInput: { maxHeight: 96 },
  sendButton: { paddingHorizontal: theme.spacing(5) },
})
