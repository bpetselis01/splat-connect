// packages/mobile/components/challenges/list-screen.tsx
// Title comes from the native header (app/(tabs)/explore/_layout.tsx), so
// this doesn't repeat it — same convention as learn-hub.tsx.
import { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeInDown } from 'react-native-reanimated'
import type { ToyIdea } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { useCapabilities } from '../../lib/capabilities'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { SkeletonRow } from '../ui/Skeleton'
import { AnimatedPressable } from '../ui/AnimatedPressable'

/**
 * GET /api/public/challenges selects exactly these columns — not a whole
 * ToyIdea. Narrowed rather than cast to ToyIdea so nothing here can reach for
 * a field (description, tutorial_id) that never arrives; the detail route is
 * where the rest of the brief lives.
 */
type ChallengeRow = Pick<ToyIdea, 'id' | 'title' | 'summary' | 'status' | 'created_at'>

function ChallengeCardRow({
  row,
  joined,
  onPress,
}: {
  row: ChallengeRow
  joined: boolean
  onPress: () => void
}) {
  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={row.title}
      accessibilityHint={joined ? "You're in. Opens the challenge." : 'Opens the challenge.'}
      pressScale={0.985}
      style={styles.rowPress}
    >
      <Card style={styles.card}>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {row.title}
          </Text>
          <Text style={styles.cardSummary} numberOfLines={2}>
            {row.summary}
          </Text>
          {/* Hidden from the a11y tree: the row's own hint above already
              says "You're in", so leaving this visible double-announces it. */}
          {joined ? (
            <View
              style={styles.badgeRow}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Badge status="challenge" label="You're in" />
            </View>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
      </Card>
    </AnimatedPressable>
  )
}

export function ChallengesListScreen() {
  const router = useRouter()
  const { caps } = useCapabilities()
  const signedIn = !!caps
  const [challenges, setChallenges] = useState<ChallengeRow[]>([])
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  // Bumping this re-runs the fetch — the retry button's handle, same as
  // toy-library-screen's reloadKey.
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError(false)
    Promise.all([
      apiClient.get<ChallengeRow[]>('/api/public/challenges'),
      // The board is public; the "you're in" marker is not. A failed joined
      // fetch loses the marker and nothing else — it must never blank the
      // challenges themselves, so it swallows its own error here rather than
      // rejecting the pair.
      signedIn
        ? apiClient.get<ToyIdea[]>('/api/ideas/joined').catch((err) => {
            console.error('[ChallengesListScreen] joined fetch failed:', err)
            return [] as ToyIdea[]
          })
        : Promise.resolve([] as ToyIdea[]),
    ])
      .then(([rows, joined]) => {
        if (ignore) return
        setChallenges(rows)
        setJoinedIds(new Set(joined.map((i) => i.id)))
      })
      .catch((err) => {
        console.error('[ChallengesListScreen] challenges fetch failed:', err)
        if (!ignore) setError(true)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [reloadKey, signedIn])

  // Joining or leaving happens on the detail screen, so the "you're in"
  // markers here are stale the moment you come back without this.
  useFocusEffect(
    useCallback(() => {
      setReloadKey((k) => k + 1)
    }, [])
  )

  const open = challenges.filter((c) => c.status === 'challenge')
  // The list shape carries no tutorial_id, so a solved row lands on its own
  // brief — which does carry it, and links on to the guide from there.
  const solved = challenges.filter((c) => c.status === 'graduated')

  const goTo = (id: string) => router.push(`/explore/challenges/${id}`)
  const submitIdea = () => router.push('/explore/challenges/new')

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.intro}>
            Problems nobody has solved yet — open to anyone, contributor or not.
          </Text>
          <Button label="+ Submit an idea" variant="accent" onPress={submitIdea} style={styles.submitPill} />
        </View>

        {loading ? (
          <View>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </View>
        ) : error ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn't load design challenges."
            hint="Check your connection and try again."
          >
            <Button
              label="Try again"
              variant="secondary"
              onPress={() => setReloadKey((k) => k + 1)}
              style={styles.retry}
            />
          </EmptyState>
        ) : challenges.length === 0 ? (
          // Day one there are no challenges, so this has to teach what one is
          // rather than apologise — same job as web's empty state.
          <EmptyState
            icon="bulb-outline"
            title="No challenges are open yet."
            hint="A design challenge is a problem our guides cannot answer yet — a toy that resists adaptation, or a need nobody has written up a fix for. Spotted one?"
          >
            <Button label="+ Submit an idea" variant="accent" onPress={submitIdea} style={styles.retry} />
          </EmptyState>
        ) : (
          <View>
            {open.length ? (
              <View style={styles.group}>
                <Text style={styles.groupTitle}>Open challenges</Text>
                {open.map((row, i) => (
                  <Animated.View
                    key={row.id}
                    entering={FadeInDown.delay(Math.min(i, 7) * theme.motion.stagger).duration(theme.motion.base)}
                  >
                    <ChallengeCardRow row={row} joined={joinedIds.has(row.id)} onPress={() => goTo(row.id)} />
                  </Animated.View>
                ))}
              </View>
            ) : null}

            {solved.length ? (
              <View style={styles.group}>
                <Text style={styles.groupTitle}>Solved · became guides</Text>
                {solved.map((row) => (
                  <ChallengeCardRow
                    key={row.id}
                    row={row}
                    joined={joinedIds.has(row.id)}
                    onPress={() => goTo(row.id)}
                  />
                ))}
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing(6) },
  topRow: { marginBottom: theme.spacing(4) },
  intro: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    lineHeight: 21,
    marginBottom: theme.spacing(3),
  },
  submitPill: { alignSelf: 'flex-start', paddingVertical: theme.spacing(2), paddingHorizontal: theme.spacing(4) },
  retry: { marginTop: theme.spacing(5), alignSelf: 'center', paddingHorizontal: theme.spacing(8) },
  group: { marginBottom: theme.spacing(4) },
  groupTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.heading,
    color: theme.colors.text,
    marginBottom: theme.spacing(2),
  },
  rowPress: { marginBottom: theme.spacing(3) },
  card: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), padding: theme.spacing(3) },
  cardBody: { flex: 1 },
  cardTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.label,
    color: theme.colors.text,
    lineHeight: 22,
  },
  cardSummary: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    lineHeight: 18,
    marginTop: theme.spacing(1),
  },
  badgeRow: { flexDirection: 'row', marginTop: theme.spacing(2) },
})
