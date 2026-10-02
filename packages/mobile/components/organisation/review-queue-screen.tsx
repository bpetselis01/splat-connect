// packages/mobile/components/organisation/review-queue-screen.tsx
// A leader's queue. Mobile's half of web's app/dashboard/organisation/page.tsx,
// with its rule verbatim: a pending backing row is a request to back; an
// accepted row on a pending tutorial is a request to review. Oldest first — a
// leader arrives asking what is oldest, not what kind of thing is oldest.
//
// The spec also asks for the "Backed" group web's page dropped: accepted
// backings whose tutorial needs nothing, so a leader can see what their name
// stands behind. Same fetch, second filter.
//
// Title comes from the native header (app/(my)/_layout.tsx: "Review queue").
import { useCallback, useEffect, useState } from 'react'
import { View, ScrollView, StyleSheet } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import type { Tutorial, TutorialOrg } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { useCapabilities } from '../../lib/capabilities'
import { Screen } from '../ui/Screen'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { SkeletonRow } from '../ui/Skeleton'
import { ListIntro, ListRow, ListSection, Pill, RowThumb, StagePill } from '../list/list-kit'
import { TUTORIAL_STAGE } from '../list/stage'

type Backed = Tutorial & { tutorial_orgs?: TutorialOrg[] }
type QueueRow = { tutorial: Backed; row: TutorialOrg; orgName: string }

const DIFFICULTY: Record<string, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }
const day = (iso: string) => new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })

function Row({
  item,
  showOrg,
  onPress,
}: {
  item: QueueRow
  /** Only when the caller leads several — one org's name on every row is noise. */
  showOrg: boolean
  onPress: () => void
}) {
  const asked = item.row.status === 'pending'
  const meta = [showOrg ? item.orgName : null, DIFFICULTY[item.tutorial.difficulty], day(item.tutorial.created_at)]
    .filter(Boolean)
    .join(' · ')
  return (
    <View style={styles.rowPress}>
      <ListRow
        title={item.tutorial.title}
        meta={meta}
        thumb={<RowThumb photo={item.tutorial.toy_photo_url} glyph="book-outline" />}
        pill={
          asked ? (
            <Pill label="Asked to back" bg={theme.colors.honeySoft} icon="hand-left-outline" />
          ) : item.tutorial.status === 'pending' ? (
            <Pill label="Ready to review" bg={theme.colors.accentLight} icon="eye-outline" />
          ) : (
            // Backed and settled: where the guide itself stands now.
            <StagePill stage={TUTORIAL_STAGE[item.tutorial.status]} />
          )
        }
        onPress={onPress}
        accessibilityHint={asked ? 'Asked to back this guide. Opens it.' : 'Opens the review.'}
      />
    </View>
  )
}

export function ReviewQueueScreen() {
  const router = useRouter()
  const { caps, loading: capsLoading } = useCapabilities()
  const ledOrgs = caps?.ledOrgs ?? []
  const [tutorials, setTutorials] = useState<Backed[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const isLeader = ledOrgs.length > 0

  useEffect(() => {
    if (!isLeader) {
      setLoading(false)
      return
    }
    let ignore = false
    setLoading(true)
    setError(false)
    apiClient
      .get<Backed[]>('/api/tutorials')
      .then((data) => {
        if (!ignore) setTutorials(data)
      })
      .catch((err) => {
        console.error('[ReviewQueueScreen] tutorials fetch failed:', err)
        if (!ignore) setError(true)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [reloadKey, isLeader])

  // Answering a request happens on the detail screen; this list is stale the
  // moment you come back without this.
  useFocusEffect(
    useCallback(() => {
      setReloadKey((k) => k + 1)
    }, [])
  )

  // While capabilities are in flight, ledOrgs is empty for everyone — showing
  // the not-a-leader copy in that window tells a real leader this isn't their
  // screen for as long as the fetch takes.
  if (capsLoading) {
    return (
      <Screen>
        <SkeletonRow />
        <SkeletonRow />
      </Screen>
    )
  }
  if (!isLeader) {
    return (
      <Screen>
        <EmptyState
          icon="business-outline"
          title="This screen belongs to organisation leaders."
          hint="When an organisation makes you a leader, what is waiting on it shows up here."
        />
      </Screen>
    )
  }

  const byId = new Map(ledOrgs.map((o) => [o.id, o]))
  const rows: QueueRow[] = tutorials.flatMap((t) =>
    (t.tutorial_orgs ?? [])
      .filter((row) => byId.has(row.org_id))
      .map((row) => ({ tutorial: t, row, orgName: byId.get(row.org_id)!.name }))
  )

  const waiting = rows
    .filter(
      ({ row, tutorial }) =>
        row.status === 'pending' || (row.status === 'accepted' && tutorial.status === 'pending')
    )
    .sort((a, b) => a.tutorial.created_at.localeCompare(b.tutorial.created_at))
  const backed = rows.filter(
    ({ row, tutorial }) => row.status === 'accepted' && tutorial.status !== 'pending'
  )

  const open = (tutorialId: string) => router.push(`/organisation/${tutorialId}`)
  const showOrg = ledOrgs.length > 1

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ListIntro
          lead={`Guides waiting for ${ledOrgs.length === 1 ? ledOrgs[0].name : 'your organisations'}. Oldest first.`}
        />
        {loading ? (
          <View>
            <SkeletonRow />
            <SkeletonRow />
          </View>
        ) : error ? (
          <EmptyState icon="cloud-offline-outline" title="Couldn't load the queue." hint="Check your connection and try again.">
            <Button label="Try again" variant="secondary" onPress={() => setReloadKey((k) => k + 1)} style={styles.retry} />
          </EmptyState>
        ) : waiting.length === 0 && backed.length === 0 ? (
          <EmptyState
            icon="file-tray-outline"
            title="Nothing waiting."
            hint="Contributors ask by choosing your organisation when they submit a guide."
          />
        ) : (
          <View>
            {waiting.length > 0 ? (
              <View style={styles.group}>
                <ListSection>Waiting on you</ListSection>
                {waiting.map((item) => (
                  <Row key={item.row.id} item={item} showOrg={showOrg} onPress={() => open(item.tutorial.id)} />
                ))}
              </View>
            ) : null}
            {backed.length > 0 ? (
              <View style={styles.group}>
                <ListSection>Backed</ListSection>
                {backed.map((item) => (
                  <Row key={item.row.id} item={item} showOrg={showOrg} onPress={() => open(item.tutorial.id)} />
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
  retry: { marginTop: theme.spacing(5), alignSelf: 'center', paddingHorizontal: theme.spacing(8) },
  group: { marginBottom: theme.spacing(4) },
  rowPress: { marginBottom: theme.spacing(3) },
})
