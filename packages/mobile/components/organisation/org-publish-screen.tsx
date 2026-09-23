// packages/mobile/components/organisation/org-publish-screen.tsx
/**
 * Events and stories — web's /dashboard/organisation/publish. What the
 * organisation has published, with publish / unpublish / remove on each row;
 * each takes effect on the public page at once, with no review.
 *
 * New ones are written on their own screens (organisation/events/new and
 * stories/new), linked from the top of the list.
 */
import { useCallback, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { EVENT_KIND_LABEL, STORY_KIND_LABEL, type OrgEvent, type OrgStory } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { useCapabilities } from '../../lib/capabilities'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Chip } from '../ui/Chip'
import { ListIntro, Pill } from '../list/list-kit'
import { Button } from '../ui/Button'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'

type Kind = 'events' | 'stories'
type Row = { id: string; title: string; meta: string; status: 'draft' | 'published'; shown: string }

const isPast = (starts: string, ends: string | null) =>
  new Date(ends ?? new Date(starts).setHours(23, 59, 59, 999)).getTime() < Date.now()
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })

export function OrgPublishScreen() {
  const router = useRouter()
  const { caps } = useCapabilities()
  const org = caps?.ledOrgs[0]
  const [data, setData] = useState<{ events: OrgEvent[]; stories: OrgStory[] } | null>(null)
  const [tab, setTab] = useState<Kind>('events')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!org) return
    Promise.all([
      apiClient.get<OrgEvent[]>(`/api/organizations/${org.id}/events`).catch(() => [] as OrgEvent[]),
      apiClient.get<OrgStory[]>(`/api/organizations/${org.id}/stories`).catch(() => [] as OrgStory[]),
    ]).then(([events, stories]) => setData({ events, stories }))
  }, [org])
  useFocusEffect(load)

  async function run(work: () => Promise<unknown>) {
    setError(null)
    setBusy(true)
    try {
      await work()
      load()
    } catch (err) {
      // A story without consent is refused by the API; its message says so.
      const detail = err instanceof Error ? /: (.+)$/.exec(err.message)?.[1] : null
      setError(detail ?? 'That did not save. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!org || !data) {
    return (
      <Screen>
        <SkeletonRow />
        <SkeletonRow />
      </Screen>
    )
  }

  const rows: Row[] =
    tab === 'events'
      ? data.events.map((e) => ({
          id: e.id,
          title: e.title,
          meta: `${EVENT_KIND_LABEL[e.kind]} · ${e.format === 'online' ? 'Online' : e.suburb ?? 'In person'} · ${shortDate(e.starts_at)}`,
          status: e.status,
          shown: e.status === 'draft' ? 'Draft' : isPast(e.starts_at, e.ends_at) ? 'Past' : 'Published',
        }))
      : data.stories.map((s) => ({
          id: s.id,
          title: s.title,
          meta: `${STORY_KIND_LABEL[s.kind]} · ${s.byline} · ${shortDate(s.published_at ?? s.created_at)}${
            s.consent_confirmed ? '' : ' · consent not confirmed'
          }`,
          status: s.status,
          shown: s.status === 'draft' ? 'Draft' : 'Published',
        }))

  const remove = (r: Row) =>
    Alert.alert(`Remove ${r.title}?`, 'It comes off the public page and cannot be brought back.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void run(() => apiClient.delete(`/api/organizations/${org.id}/${tab}/${r.id}`)) },
    ])

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ListIntro lead={`Published items are live on ${org.name}'s public page right now.`} />
        <View style={styles.actions}>
          <Button label="New event" onPress={() => router.push('/organisation/events/new')} style={styles.grow} />
          <Button label="New story" variant="secondary" onPress={() => router.push('/organisation/stories/new')} style={styles.grow} />
        </View>
        <View style={styles.tabs} accessibilityRole="radiogroup">
          <Chip role="radio" label={`Events · ${data.events.length}`} active={tab === 'events'} onPress={() => setTab('events')} />
          <Chip role="radio" label={`Stories · ${data.stories.length}`} active={tab === 'stories'} onPress={() => setTab('stories')} />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {rows.length === 0 ? (
          <EmptyState
            icon={tab === 'events' ? 'calendar-outline' : 'newspaper-outline'}
            title={tab === 'events' ? 'No events yet' : 'No stories yet'}
            hint={
              tab === 'events'
                ? 'A build day or open afternoon is the fastest way to meet the families near you.'
                : 'One thing that happened, told plainly. It takes ten minutes.'
            }
          />
        ) : (
          rows.map((r) => (
            <Card key={r.id} style={styles.row}>
              <Text style={styles.title}>{r.title}</Text>
              <Text style={styles.meta}>{r.meta}</Text>
              {/* Web's tints: draft amber, past grey, published green. */}
              <Pill
                label={r.shown}
                bg={r.shown === 'Draft' ? theme.colors.honeySoft : r.shown === 'Past' ? theme.colors.surfaceSunken : theme.colors.mintSoft}
                fg={r.shown === 'Past' ? theme.colors.muted : theme.colors.ink}
                icon={r.shown === 'Draft' ? 'create-outline' : r.shown === 'Past' ? 'time-outline' : 'radio-outline'}
              />
              <View style={styles.actions}>
                <Button
                  label={r.status === 'published' ? 'Unpublish' : 'Publish'}
                  variant="secondary"
                  disabled={busy}
                  onPress={() =>
                    void run(() =>
                      apiClient.patch(`/api/organizations/${org.id}/${tab}/${r.id}`, {
                        status: r.status === 'published' ? 'draft' : 'published',
                      })
                    )
                  }
                />
                <Button label="Remove" variant="danger" disabled={busy} accessibilityLabel={`Remove ${r.title}`} onPress={() => remove(r)} />
              </View>
            </Card>
          ))
        )}
        <Text style={styles.foot}>
          Events and stories go live without review. They carry your organisation's name, so the leader terms apply:
          nothing that names a child or family without their agreement, and no medical claims.
        </Text>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { gap: theme.spacing(3), paddingBottom: theme.spacing(8) },
  tabs: { flexDirection: 'row', gap: theme.spacing(2), marginBottom: theme.spacing(1) },
  error: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.danger },
  // The board's list row, with the row's own actions under its pill.
  row: { padding: 15, gap: 2, borderRadius: theme.radii.panel, ...theme.shadow(1) },
  title: { fontFamily: theme.fonts.black, fontSize: 15, lineHeight: 20, color: theme.colors.ink },
  meta: { fontFamily: theme.fonts.regular, fontSize: 12.5, lineHeight: 18, color: theme.colors.muted, marginBottom: 5 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing(2), marginTop: theme.spacing(2) },
  grow: { flex: 1, borderRadius: theme.radii.pill },
  foot: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, lineHeight: 19, marginTop: theme.spacing(3) },
})
