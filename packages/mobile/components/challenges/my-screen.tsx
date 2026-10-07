// packages/mobile/components/challenges/my-screen.tsx
// The author-side view: every idea this account submitted, at any status, and
// every challenge it joined as a maker. Mobile's half of web's
// app/dashboard/challenges/page.tsx — same two endpoints, same linking rule,
// same independent failure states.
//
// Title comes from the native header (app/(my)/_layout.tsx).
import { logFailure } from '../../lib/log'
import { useCallback, useEffect, useState } from 'react'
import { View, ScrollView, StyleSheet } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { plural, type MyIdea, type ToyIdeaStatus } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { shortDate } from './challenge-status'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { SkeletonRow } from '../ui/Skeleton'
import { ListIntro, ListRow, ListSection, RowThumb, StageFilter, StageNone, StagePill } from '../list/list-kit'
import { stageOptions, type StageKey } from '../list/stage'

/** Ported verbatim from web's components/badge.tsx — the author-facing
 *  wording for an idea's lifecycle, which is not the public wording the
 *  challenge brief uses for the same statuses. */
const IDEA_LABEL: Record<ToyIdeaStatus, string> = {
  pending: 'Pending review',
  challenge: 'Looking for makers',
  graduated: 'Being written up',
  rejected: 'Not taken forward',
}

type Loaded = { items: MyIdea[]; failed: boolean }
const NOTHING: Loaded = { items: [], failed: false }

/** The board's CSTAGE: an idea's lifecycle on the shared stage words. */
const IDEA_STAGE: Record<ToyIdeaStatus, StageKey> = {
  pending: 'waiting',
  challenge: 'live',
  graduated: 'waiting',
  rejected: 'declined',
}

/** The board's second line for each row (MB my_challenges). A rejected idea's
 *  reason is read on the idea itself, never on the list. */
export function ideaMeta(idea: MyIdea, joined: boolean): string {
  const makers = idea.maker_count ?? 0
  if (joined) {
    const when = `Joined ${shortDate(idea.joined_at ?? idea.created_at)}`
    return idea.status === 'graduated'
      ? `${when} · being written up`
      : `${when} · ${plural(makers, 'maker')} · ${plural(idea.answer_count ?? 0, 'post')}`
  }
  const submitted = `Your idea · submitted ${shortDate(idea.created_at)}`
  switch (idea.status) {
    case 'pending':
      return `${submitted} · with an admin`
    case 'challenge':
      return `${submitted} · ${plural(makers, 'maker')} joined`
    case 'graduated':
      return `${submitted} · being written up`
    case 'rejected':
      return `Your idea · declined ${shortDate(idea.updated_at)}${idea.review_note ? ' — a reason is attached' : ''}`
  }
}

function IdeaRow({ idea, joined, onOpen }: { idea: MyIdea; joined: boolean; onOpen: () => void }) {
  const meta = ideaMeta(idea, joined)

  return (
    <View style={styles.rowWrap}>
      <ListRow
        title={idea.title}
        meta={meta}
        thumb={<RowThumb glyph="bulb-outline" />}
        pill={<StagePill stage={IDEA_STAGE[idea.status]} label={IDEA_LABEL[idea.status]} />}
        onPress={onOpen}
        accessibilityHint="Opens the challenge."
      />
    </View>
  )
}

function Group({
  title,
  loaded,
  loading,
  failureCopy,
  empty,
  onOpen,
  stage,
  joined,
}: {
  stage: 'all' | StageKey
  joined: boolean
  title: string
  loaded: Loaded
  loading: boolean
  failureCopy: string
  empty: { title: string; hint: string; label: string; onPress: () => void; icon: React.ComponentProps<typeof Ionicons>['name'] }
  onOpen: (id: string) => void
}) {
  const shown = stage === 'all' ? loaded.items : loaded.items.filter((i) => IDEA_STAGE[i.status] === stage)
  // A filtered-out group says nothing rather than an empty state that would
  // invite submitting an idea someone already has.
  if (stage !== 'all' && !loading && !loaded.failed && shown.length === 0) return null
  return (
    <View style={styles.group}>
      <ListSection>{title}</ListSection>
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
        shown.map((idea) => (
          <IdeaRow key={idea.id} idea={idea} joined={joined} onOpen={() => onOpen(idea.id)} />
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
  const [stage, setStage] = useState<'all' | StageKey>('all')

  useEffect(() => {
    let ignore = false
    // Two independent lists, two independent failure states — one endpoint
    // being flaky must not blank the other section.
    const load = (path: string, set: (v: Loaded) => void) =>
      apiClient
        .get<MyIdea[]>(path)
        .then((items) => {
          if (!ignore) set({ items, failed: false })
        })
        .catch((err) => {
          logFailure(`[MyChallengesScreen] ${path} failed:`, err)
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

  // One idea can be both yours and joined; count it once.
  const all = [...new Map([...mine.items, ...joined.items].map((i) => [i.id, i])).values()]
  const options = stageOptions(all, (i) => IDEA_STAGE[i.status], ['live', 'waiting', 'declined'])
  const shownCount = stage === 'all' ? all.length : (options.find((o) => o.id === stage)?.n ?? 0)

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Persistent, not empty-state-only: once one idea exists the empty
            state's button is gone, and this is the only way back to the form. */}
        <ListIntro
          lead="Challenges you have joined as a maker, and ideas you have submitted at every stage of review."
          cta="+ Submit an idea"
          onCta={() => router.push('/explore/challenges/new')}
        />

        {!loading && all.length > 0 ? (
          <StageFilter label="Filter by stage" options={options} current={stage} onPick={setStage} />
        ) : null}
        {!loading && stage !== 'all' && shownCount === 0 ? <StageNone onClear={() => setStage('all')} /> : null}

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
          stage={stage}
          joined={false}
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
          stage={stage}
          joined
        />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing(6) },
  group: { marginBottom: theme.spacing(4) },
  emptyButton: { marginTop: theme.spacing(5), paddingHorizontal: theme.spacing(6) },
  rowWrap: { marginBottom: theme.spacing(3) },
})
