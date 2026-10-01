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
  Image,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { challengeHistory, challengePill, challengeStats, shortDate } from './challenge-status'
import { isApiError, OUTCOME_STEPS, outcomeStates, PARTICIPANT_ROLE_LABEL } from '@splat-connect/types'
import type { ToyIdea, ToyIdeaDetail, ToyIdeaMessage, ContactPref } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { confirmDestructive } from '../../lib/confirm'
import { theme } from '../../lib/theme'
import { useSaves } from '../../lib/saves'
import { useCapabilities } from '../../lib/capabilities'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { useFlash, FlashLine } from '../ui/Flash'
import { Skeleton } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { SaveButton } from '../ui/SaveButton'
import { TextField } from '../ui/TextField'
import { MessageBubble } from '../ui/MessageBubble'
import { Pill } from '../list/list-kit'

// Same cadence as the exchange thread. Web runs this conversation on a
// realtime subscription; mobile polls, the Phase-3 ruling repeated.
const POLL_MS = 10_000

// Same three labels web's [id]/page.tsx renders, for the same field.
const CONTACT_PREF_LABELS: Record<ContactPref, string> = {
  clarification: 'Clarification',
  co_design: 'Co-design',
  user_testing: 'User testing',
}

type Tab = 'status' | 'brief' | 'constraints' | 'makers' | 'thread' | 'outcome'
// title and hint: the board's heading and muted line over each tab (MB CDT).
const TABS: { id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; title: string; hint: string }[] = [
  { id: 'status', label: 'Status', icon: 'pulse-outline', title: 'Status', hint: 'Where this idea is, and what happens next.' },
  { id: 'brief', label: 'Brief', icon: 'document-text-outline', title: 'The brief', hint: 'What is being asked for, and why nothing off the shelf does it.' },
  { id: 'constraints', label: 'Constraints', icon: 'alert-circle-outline', title: 'Constraints', hint: 'What makes this harder than it looks.' },
  { id: 'makers', label: 'Makers', icon: 'people-outline', title: 'Makers', hint: 'Everyone working on this.' },
  { id: 'thread', label: 'Thread', icon: 'chatbubbles-outline', title: 'Thread', hint: 'Where the work happens. Makers can post.' },
  { id: 'outcome', label: 'Outcome', icon: 'flag-outline', title: 'Outcome', hint: 'What happens when somebody solves it.' },
]

// The board's CDSTEP: a tick, a dot, a dash.
const STEP_ICON = { done: 'checkmark', now: 'ellipse', todo: 'remove' } as const
const STEP_TONE = {
  done: { backgroundColor: theme.colors.primaryDark },
  now: { backgroundColor: theme.colors.honeySoft },
  todo: { backgroundColor: theme.colors.surfaceSunken },
} as const

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  )
}

/** A static pill. Chip is a toggle — these are read-only facts, not filters. */
// The board's heading and hint, inside the tab's own card.
function TabHead({ id }: { id: Tab }) {
  const t = TABS.find((x) => x.id === id)!
  return (
    <View style={styles.tabHead}>
      <Text style={styles.tabTitle} accessibilityRole="header">
        {t.title}
      </Text>
      <Text style={styles.tabHint}>{t.hint}</Text>
    </View>
  )
}

export function ChallengeDetailScreen({ id }: { id: string }) {
  const router = useRouter()
  const saves = useSaves()
  const { caps, loading: capsLoading } = useCapabilities()
  const [challenge, setChallenge] = useState<ToyIdeaDetail | null>(null)
  const [loading, setLoading] = useState(true)
  // Read from the author's own list, not the public one (challenge-author-states).
  const [mine, setMine] = useState(false)
  const [withdrawn, setWithdrawn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ToyIdeaMessage[]>([])
  const [draft, setDraft] = useState('')
  const [constraintLabel, setConstraintLabel] = useState('')
  const [constraintNote, setConstraintNote] = useState('')
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
  const [flash, setFlash] = useFlash()

  const viewerId = caps?.profile.id ?? null
  const viewerName = caps?.profile.name ?? null

  useEffect(() => {
    let ignore = false
    apiClient
      .get<ToyIdeaDetail>(`/api/public/challenges/${id}`)
      .catch(async (err) => {
        // A pending or rejected idea 404s publicly. Its author reads it from
        // their own list instead (challenge-author-states); nobody else can,
        // and a dropped connection is not a 404.
        if (!viewerId || !isApiError(err) || err.status !== 404) throw err
        const own = await apiClient.get<ToyIdea>(`/api/ideas/mine/${id}`)
        if (!ignore) setMine(true)
        return { ...own, author_name: viewerName, participants: [], maker_count: 0, answer_count: 0 } as ToyIdeaDetail
      })
      .then((data) => {
        if (ignore) return
        setChallenge(data)
        setLoading(false)
      })
      // No separate error flag: having a brief or not is the whole question,
      // and a join/leave refetch that fails must leave the brief on screen
      // rather than replacing a loaded challenge with "couldn't load". While
      // capabilities are still loading we do not yet know whether this is
      // the author, so the skeleton stays and the rerun decides.
      .catch(() => {
        if (!ignore && !capsLoading) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [id, reloadKey, viewerId, viewerName, capsLoading])

  // An anonymous challenge comes back with no author_id (108). Its author
  // still owns it here — the thread, the controls — through their own list.
  useEffect(() => {
    if (!viewerId || !challenge || challenge.author_id !== null) return
    let ignore = false
    apiClient
      .get(`/api/ideas/mine/${id}`)
      .then(() => {
        if (!ignore) setMine(true)
      })
      .catch(() => {})
    return () => {
      ignore = true
    }
  }, [viewerId, challenge, id])

  // The public author, or the viewer for their own anonymous idea (F14).
  const authorId = challenge?.author_id ?? (mine ? viewerId : null)
  const isAuthor = viewerId !== null && authorId === viewerId
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
  // Only a public idea has a thread; a pending or rejected one hides the tab,
  // so nothing polls it either (Task 9's carry).
  const canRead = (joined || isAuthor) && (open || challenge?.status === 'graduated')

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

  async function addConstraint() {
    const label = constraintLabel.trim()
    if (!label) return
    setBusy(true)
    setActionError(null)
    try {
      await apiClient.post(`/api/ideas/${id}/constraints`, { label, note: constraintNote.trim() || null })
      setConstraintLabel('')
      setConstraintNote('')
      setReloadKey((k) => k + 1)
    } catch {
      setActionError('Could not add that constraint. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function withdraw() {
    setBusy(true)
    setActionError(null)
    try {
      await apiClient.delete(`/api/ideas/${id}`)
      setWithdrawn(true)
    } catch {
      setActionError('Could not withdraw this idea. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  // "Follow the write-up" is a save (challenge-writeup-stage): 109 tells every
  // saver when the guide is published. Never unsaves — following twice is fine.
  async function follow() {
    if (!saves.isSaved('challenges', id)) await saves.toggle('challenges', id)
    setFlash('You will be told when the guide is published')
  }

  function confirmLeave() {
    confirmDestructive('Leave this challenge?', 'You will stop taking part in its conversation.', 'Leave', () => void leave())
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
  if (withdrawn) {
    return (
      <View style={styles.screen}>
        <EmptyState icon="arrow-undo-outline" title="Withdrawn — nothing was published" />
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
    if (senderId === authorId) return challenge.author_name ?? (authorId === viewerId ? viewerName : null) ?? 'Someone'
    // Someone who has left keeps their messages but loses their participant
    // row, so there is genuinely no name left to show for them.
    return challenge.participants.find((p) => p.profile_id === senderId)?.name ?? 'Someone'
  }

  const pill = challengePill(challenge)
  const stats = challengeStats(challenge, new Date())
  const history = challengeHistory(challenge)
  const makers = challenge.maker_count ?? challenge.participants.length
  // The board draws Makers and Thread only once the idea is public (MB cdOpen:
  // challenge or graduated). The count badges are the board's too.
  const listed = challenge.status === 'challenge' || challenge.status === 'graduated'
  const tabs = TABS.filter((t) => (listed || (t.id !== 'makers' && t.id !== 'thread')) && !(question && t.id === 'outcome'))
  const badge: Partial<Record<Tab, number>> = { makers, thread: challenge.answer_count ?? 0, constraints: challenge.constraints?.length ?? 0 }
  const headline =
    challenge.status === 'pending'
      ? { title: 'An admin is reading it', body: 'Nothing is public yet. Most ideas are answered inside a week — approved, it opens as a challenge; if not, you get a reason.' }
      : challenge.status === 'rejected'
        ? { title: 'Not taken forward', body: 'An admin read it and decided it is not one for SPLAT. Nothing was published. The reason is below — a revised idea is welcome.' }
        : challenge.status === 'graduated'
          ? { title: 'Somebody solved it', body: 'A maker is turning the solution into a guide. The brief stays up, with the guide linked once it is approved.' }
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
        onContentSizeChange={() => canRead && tab === 'thread' && logRef.current?.scrollToEnd({ animated: false })}
      >
        <View style={styles.statusLine}>
          <Badge status={pill.status} label={pill.label} />
          <Text style={styles.meta}>
            {listed
              ? `Published ${shortDate(challenge.created_at)} · ${challenge.author_name ?? 'anonymous'}`
              : `Submitted ${shortDate(challenge.created_at)} · only you can see this`}
          </Text>
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {challenge.title}
        </Text>

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
              // authorship, not by joining. Before it is public, the author's
              // two moves: withdraw it, or send a revised one.
              challenge.status === 'pending' ? (
                <Button label="Withdraw the idea" variant="secondary" loading={busy} onPress={() => void withdraw()} />
              ) : challenge.status === 'rejected' ? (
                <Button label="Submit a revised idea" variant="accent" onPress={() => router.push(`/explore/challenges/new?from=${id}`)} />
              ) : (
                <Text style={styles.quiet}>This is your challenge.</Text>
              )
            ) : open ? (
              <Button
                label={question ? 'Join to answer' : 'Join this challenge'}
                loading={busy}
                onPress={() => void join()}
              />
            ) : challenge.status === 'graduated' ? (
              <Button label="Follow the write-up" onPress={() => void follow()} />
            ) : (
              <Text style={styles.quiet}>
                This challenge has moved on to write-up, so joining is no longer open.
              </Text>
            )}
          </View>
          {listed ? <SaveButton slug="challenges" id={challenge.id} saves={saves} circled /> : null}
        </View>
        <FlashLine message={flash} />
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
          {tabs.map((t) => {
            const n = badge[t.id] ?? 0
            return (
              <Pressable
                key={t.id}
                accessibilityRole="tab"
                accessibilityLabel={t.label}
                accessibilityValue={n > 0 ? { text: String(n) } : undefined}
                accessibilityState={{ selected: tab === t.id }}
                onPress={() => setTab(t.id)}
                style={[styles.tab, tab === t.id && styles.tabOn]}
              >
                <Ionicons name={t.icon} size={15} color={theme.colors.ink} />
                <Text style={styles.tabText}>{t.label}</Text>
                {n > 0 ? <Text style={styles.tabBadge}>{n}</Text> : null}
              </Pressable>
            )
          })}
        </ScrollView>

        {tab === 'status' ? (
          <Card style={styles.panel}>
            <TabHead id="status" />
            <View style={styles.headline}>
              <Text style={styles.headlineTitle}>{headline.title}</Text>
              <Text style={styles.quiet}>{headline.body}</Text>
            </View>
            {challenge.status === 'graduated' && challenge.writing_up ? (
              <View style={styles.makerRow}>
                <Text style={styles.makerName}>{`${challenge.writing_up.name} is writing this up`}</Text>
                <Text style={styles.eventDate}>
                  {`Started ${shortDate(challenge.writing_up.started_at)}. The draft still goes through review before a family sees it.`}
                </Text>
              </View>
            ) : null}
            {challenge.status === 'rejected' && challenge.review_note ? (
              <View style={styles.note}>
                <Text style={styles.noteLead}>Why it was not taken forward:</Text>
                <Text style={styles.noteText}>{challenge.review_note}</Text>
              </View>
            ) : null}
            {listed ? (
              <View style={styles.stats}>
                {stats.map((s) => (
                  <View key={s.label} style={styles.stat}>
                    <Text style={styles.statN}>{s.n}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>
            ) : null}
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
            <TabHead id="brief" />
            {challenge.photo_url ? (
              <Image
                testID="challenge-photo"
                source={{ uri: challenge.photo_url }}
                style={styles.hero}
                accessibilityIgnoresInvertColors
              />
            ) : null}
            {challenge.description ? <Field label="The problem" value={challenge.description} /> : null}
            <View>
              <Text style={styles.blockTitle}>What a solution has to do</Text>
              <Text style={styles.summary}>{challenge.summary}</Text>
            </View>
          </Card>
        ) : null}

        {tab === 'constraints' ? (
          <Card style={styles.panel}>
            <TabHead id="constraints" />
            {challenge.constraints?.length ? (
              <View accessibilityRole="list" style={styles.makerList}>
                {challenge.constraints.map((k) => (
                  <View key={k.id} style={styles.makerRow}>
                    <Text style={styles.makerName}>{k.label}</Text>
                    {k.note ? <Text style={styles.eventDate}>{k.note}</Text> : null}
                  </View>
                ))}
              </View>
            ) : (
              // Ideas from before 110 carry these two instead (103 kept them).
              <>
                {challenge.intended_use ? <Field label="Intended use" value={challenge.intended_use} /> : null}
                {challenge.primary_user ? <Field label="Who it's for" value={challenge.primary_user} /> : null}
              </>
            )}
            {listed && (isAuthor || joined) ? (
              <View style={styles.addConstraint}>
                <TextField accessibilityLabel="Constraint" placeholder="Constraint" maxLength={80} value={constraintLabel} onChangeText={setConstraintLabel} />
                <TextField accessibilityLabel="Note (optional)" placeholder="Note (optional)" maxLength={300} multiline value={constraintNote} onChangeText={setConstraintNote} />
                <Button label="Add a constraint" variant="secondary" disabled={busy || !constraintLabel.trim()} onPress={() => void addConstraint()} />
              </View>
            ) : null}
          </Card>
        ) : null}

        {tab === 'makers' ? (
          <Card style={styles.panel}>
            <TabHead id="makers" />
            {challenge.participants.length === 0 ? (
              <Text style={styles.quiet}>Nobody has joined yet.</Text>
            ) : (
              <View accessibilityRole="list" style={styles.makerList}>
                {challenge.participants.map((p) => {
                  const meta = [
                    p.role ? PARTICIPANT_ROLE_LABEL[p.role] : null,
                    `joined ${shortDate(p.joined_at)}`,
                    challenge.writing_up?.profile_id === p.profile_id ? 'writing it up' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                  return (
                    <View key={p.profile_id} style={styles.makerRow}>
                      <Text style={styles.makerName}>{p.profile_id === viewerId ? 'You' : p.name ?? 'Someone'}</Text>
                      <Text style={styles.eventDate}>{meta}</Text>
                    </View>
                  )
                })}
              </View>
            )}
            {challenge.contact_prefs.length > 0 ? (
              <View>
                <Text style={styles.blockTitle}>The author is happy to help with</Text>
                <View style={styles.tagRow}>
                  {challenge.contact_prefs.map((pref) => (
                    <Pill key={pref} variant="outline" label={CONTACT_PREF_LABELS[pref]} bg={theme.colors.surface} fg={theme.colors.text} />
                  ))}
                </View>
              </View>
            ) : null}
          </Card>
        ) : null}

        {tab === 'thread' ? (
          <Card style={styles.panel}>
            <TabHead id="thread" />
          </Card>
        ) : null}

        {tab === 'outcome' ? (
          <Card style={styles.panel}>
            <TabHead id="outcome" />
            <View accessibilityRole="list">
              {OUTCOME_STEPS.map((s, i) => {
                const state = outcomeStates(challenge.status)[i]
                return (
                  <View key={s.label} style={styles.event}>
                    <View style={[styles.stepDot, STEP_TONE[state]]}>
                      <Ionicons name={STEP_ICON[state]} size={13} color={state === 'done' ? theme.colors.surface : theme.colors.ink} />
                    </View>
                    <View style={styles.eventText}>
                      <Text style={[styles.eventTitle, state === 'todo' && styles.stepTodo]}>{s.label}</Text>
                      <Text style={styles.eventDate}>{s.note.mobile}</Text>
                    </View>
                  </View>
                )
              })}
            </View>
          </Card>
        ) : null}

        {tab === 'thread' && canRead ? (
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
                if (isAuthor && m.kind === 'user' && m.sender_id !== authorId) {
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

      {canRead && tab === 'thread' ? (
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
  tabBadge: {
    minWidth: 18,
    paddingHorizontal: 5,
    borderRadius: theme.radii.pill,
    overflow: 'hidden',
    textAlign: 'center',
    fontFamily: theme.fonts.black,
    fontSize: 11,
    lineHeight: 18,
    color: theme.colors.ink,
    backgroundColor: theme.colors.accentLight,
  },
  tabText: { fontFamily: theme.fonts.black, fontSize: 12.5, color: theme.colors.ink },
  panel: { gap: theme.spacing(3), padding: theme.spacing(4) },
  panelTitle: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  tabHead: { gap: theme.spacing(1) },
  tabTitle: { fontFamily: theme.fonts.display, fontSize: 18, color: theme.colors.text },
  tabHint: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.muted },
  // The board's live-status box: 16px, the success tint.
  headline: {
    gap: theme.spacing(1),
    padding: theme.spacing(4),
    borderRadius: 16,
    backgroundColor: theme.colors.successSoft,
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
  stepDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stepTodo: { color: theme.colors.muted },
  eventRail: { alignItems: 'center', width: 16 },
  eventDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4, backgroundColor: theme.colors.accentLight },
  eventLine: { width: 2, flex: 1, backgroundColor: theme.colors.border },
  eventText: { flex: 1, paddingBottom: theme.spacing(3) },
  eventTitle: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  eventDate: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted },
  hero: { height: 160, borderRadius: 16, width: '100%' },
  note: { gap: 2, padding: theme.spacing(3), borderRadius: 14, backgroundColor: theme.colors.apricotSoft },
  noteLead: { fontFamily: theme.fonts.black, fontSize: 13.5, lineHeight: 20, color: theme.colors.ink },
  noteText: { fontFamily: theme.fonts.regular, fontSize: 13.5, lineHeight: 20, color: theme.colors.ink },
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
  makerList: { gap: theme.spacing(2) },
  addConstraint: { gap: theme.spacing(1) },
  makerRow: { padding: theme.spacing(3), borderRadius: theme.radii.field, backgroundColor: theme.colors.surfaceSunken, gap: 2 },
  makerName: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
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
