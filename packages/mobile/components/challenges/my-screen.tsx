// packages/mobile/components/challenges/my-screen.tsx
// The author-side view: every idea this account submitted, at any status, and
// every challenge it joined as a maker. Mobile's half of web's
// app/dashboard/challenges/page.tsx — same two endpoints, same linking rule,
// same independent failure states.
//
// Title comes from the native header (app/(my)/_layout.tsx).
import { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { ToyIdea, ToyIdeaStatus } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { SkeletonRow } from '../ui/Skeleton'
import { AnimatedPressable } from '../ui/AnimatedPressable'

/** Ported verbatim from web's components/badge.tsx — the author-facing
 *  wording for an idea's lifecycle, which is not the public wording the
 *  challenge brief uses for the same statuses. */
const IDEA_LABEL: Record<ToyIdeaStatus, string> = {
  pending: 'Pending review',
  challenge: 'Looking for makers',
  graduated: 'Being written up',
  rejected: 'Not taken forward',
}

type Loaded = { items: ToyIdea[]; failed: boolean }
const NOTHING: Loaded = { items: [], failed: false }

function IdeaRow({ idea, onOpen }: { idea: ToyIdea; onOpen: () => void }) {
  // Only a published challenge has a public page — GET
  // /api/public/challenges/:id 404s a pending or rejected idea by design — so
  // those rows stay unpressable rather than pointing at a dead route. Every
  // joined idea is 'challenge' or 'graduated' by construction (038's join
  // policy), so this always resolves true in that section.
  const linkable = idea.status === 'challenge' || idea.status === 'graduated'

  const body = (
    <Card style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {idea.title}
        </Text>
        <Badge status={idea.status} label={IDEA_LABEL[idea.status]} />
      </View>
      <Text style={styles.cardSummary} numberOfLines={2}>
        {idea.summary}
      </Text>
      {/* review_note is the point of the rejected state — an admin's reason
          for declining, never shown publicly, only to the author here.
          Absent only when an admin rejected without one. */}
      {idea.status === 'rejected' && idea.review_note ? (
        <Text style={styles.note}>{idea.review_note}</Text>
      ) : null}
    </Card>
  )

  if (!linkable) return <View style={styles.rowWrap}>{body}</View>
  return (
    <AnimatedPressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={idea.title}
      accessibilityHint="Opens the public challenge."
      pressScale={0.985}
      style={styles.rowWrap}
    >
      {body}
    </AnimatedPressable>
  )
}

function Group({
  title,
  loaded,
  loading,
  failureCopy,
  empty,
  onOpen,
}: {
  title: string
  loaded: Loaded
  loading: boolean
  failureCopy: string
  empty: { title: string; hint: string; label: string; onPress: () => void; icon: React.ComponentProps<typeof Ionicons>['name'] }
  onOpen: (id: string) => void
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      {loading ? (
        <SkeletonRow />
      ) : loaded.failed ? (
        // Never folded into the empty state: telling someone they have
        // submitted nothing, when the endpoint merely fell over, is a lie
        // about their own work.
        <EmptyState
          icon="cloud-offline-outline"
          title={failureCopy}
          hint="Something has gone wrong on our end. Try again in a moment."
        />
      ) : loaded.items.length === 0 ? (
        <EmptyState icon={empty.icon} title={empty.title} hint={empty.hint}>
          <Button label={empty.label} variant="accent" onPress={empty.onPress} style={styles.emptyButton} />
        </EmptyState>
      ) : (
        loaded.items.map((idea) => (
          <IdeaRow key={idea.id} idea={idea} onOpen={() => onOpen(idea.id)} />
        ))
      )}
    </View>
  )
}

export function MyChallengesScreen() {
  const router = useRouter()
  const [mine, setMine] = useState<Loaded>(NOTHING)
  const [joined, setJoined] = useState<Loaded>(NOTHING)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let ignore = false
    // Two independent lists, two independent failure states — one endpoint
    // being flaky must not blank the other section.
    const load = (path: string, set: (v: Loaded) => void) =>
      apiClient
        .get<ToyIdea[]>(path)
        .then((items) => {
          if (!ignore) set({ items, failed: false })
        })
        .catch((err) => {
          console.error(`[MyChallengesScreen] ${path} failed:`, err)
          if (!ignore) set({ items: [], failed: true })
        })

    setLoading(true)
    Promise.all([load('/api/ideas/mine', setMine), load('/api/ideas/joined', setJoined)]).then(() => {
      if (!ignore) setLoading(false)
    })
    return () => {
      ignore = true
    }
  }, [reloadKey])

  // Submitting an idea or joining a challenge both happen on the Explore side,
  // so these lists are stale the moment you come back without this.
  useFocusEffect(
    useCallback(() => {
      setReloadKey((k) => k + 1)
    }, [])
  )

  const openChallenge = (id: string) => router.push(`/explore/challenges/${id}`)

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Persistent, not empty-state-only: once one idea exists the empty
            state's button is gone, and this is the only way back to the form. */}
        <Button
          label="+ Submit an idea"
          variant="accent"
          onPress={() => router.push('/explore/challenges/new')}
          style={styles.submitPill}
        />

        <Group
          title="Your ideas"
          loaded={mine}
          loading={loading}
          failureCopy="Could not load your ideas."
          empty={{
            icon: 'document-text-outline',
            title: "You haven't submitted an idea yet.",
            hint: 'Spotted a toy that resists adaptation, or a need no guide covers yet? Tell us about it.',
            label: 'Submit an idea',
            onPress: () => router.push('/explore/challenges/new'),
          }}
          onOpen={openChallenge}
        />

        <Group
          title="Challenges you joined"
          loaded={joined}
          loading={loading}
          failureCopy="Could not load your joined challenges."
          empty={{
            icon: 'people-outline',
            title: "You haven't joined a challenge yet.",
            hint: 'Browse open challenges and find one to work on.',
            label: 'Browse design challenges',
            onPress: () => router.push('/explore/challenges'),
          }}
          onOpen={openChallenge}
        />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing(6) },
  submitPill: {
    alignSelf: 'flex-start',
    marginBottom: theme.spacing(4),
    paddingVertical: theme.spacing(2),
    paddingHorizontal: theme.spacing(4),
  },
  group: { marginBottom: theme.spacing(4) },
  groupTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.heading,
    color: theme.colors.text,
    marginBottom: theme.spacing(2),
  },
  emptyButton: { marginTop: theme.spacing(5), paddingHorizontal: theme.spacing(6) },
  rowWrap: { marginBottom: theme.spacing(3) },
  card: { padding: theme.spacing(3), gap: theme.spacing(1) },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  cardTitle: {
    flex: 1,
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.label,
    color: theme.colors.text,
  },
  cardSummary: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    lineHeight: 18,
  },
  note: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    lineHeight: 18,
    borderTopWidth: theme.border.thin,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing(2),
    marginTop: theme.spacing(1),
  },
})
