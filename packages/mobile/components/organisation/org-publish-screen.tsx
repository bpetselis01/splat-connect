// packages/mobile/components/organisation/org-publish-screen.tsx
/**
 * Events and stories — web's /dashboard/organisation/publish. What the
 * organisation has published, with publish / unpublish / remove on each row;
 * each takes effect on the public page at once, with no review.
 *
 * Writing a new event or story stays on web: the event form's registration-
 * question editor is the bulk of that screen and not a phone-sized job.
 */
import { useCallback, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { EVENT_KIND_LABEL, STORY_KIND_LABEL, type OrgEvent, type OrgStory } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { useCapabilities } from '../../lib/capabilities'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Chip } from '../ui/Chip'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'

type Kind = 'events' | 'stories'
type Row = { id: string; title: string; meta: string; status: 'draft' | 'published'; shown: string }

const isPast = (starts: string, ends: string | null) =>
  new Date(ends ?? new Date(starts).setHours(23, 59, 59, 999)).getTime() < Date.now()
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })

export function OrgPublishScreen() {
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
        <Text style={styles.lede}>Published items are live on {org.name}'s public page right now. New ones are written on the web.</Text>
        <View style={styles.tabs} accessibilityRole="radiogroup">
          <Chip role="radio" label={`Events · ${data.events.length}`} active={tab === 'events'} onPress={() => setTab('events')} />
          <Chip role="radio" label={`Stories · ${data.stories.length}`} active={tab === 'stories'} onPress={() => setTab('stories')} />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {rows.length === 0 ? (
          <EmptyState
            icon={tab === 'events' ? 'calendar-outline' : 'newspaper-outline'}
            title={tab === 'events' ? 'No events yet' : 'No stories yet'}
            hint="Publish one from Events and stories on the web; it shows up here to manage."
          />
        ) : (
          rows.map((r) => (
            <Card key={r.id} style={styles.row}>
              <View style={styles.top}>
                <Text style={styles.title}>{r.title}</Text>
                {/* Web's tints: draft amber, past grey, published green. */}
                <Badge status={r.shown === 'Draft' ? 'pending' : r.shown === 'Past' ? 'draft' : 'published'} label={r.shown} />
              </View>
              <Text style={styles.meta}>{r.meta}</Text>
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
  content: { gap: theme.spacing(2), paddingBottom: theme.spacing(8) },
  lede: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, lineHeight: 21, marginBottom: theme.spacing(1) },
  tabs: { flexDirection: 'row', gap: theme.spacing(2), marginBottom: theme.spacing(2) },
  error: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.danger },
  row: { padding: theme.spacing(4), gap: theme.spacing(2) },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: theme.spacing(2) },
  title: { fontFamily: theme.fonts.display, fontSize: theme.type.body, color: theme.colors.text, flex: 1 },
  meta: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted },
  actions: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing(2) },
  foot: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, lineHeight: 19, marginTop: theme.spacing(3) },
})
