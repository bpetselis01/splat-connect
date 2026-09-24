// packages/mobile/components/events/my-events-screen.tsx
/**
 * My events — web's /dashboard/events on the phone: what you said you are
 * going to, and where any part-print request with the host is up to. One row
 * for both, because a family asks one question about a Sunday: "am I going,
 * and will my parts be there".
 *
 * A declined print carries its next step (a printer nearby), not just the word.
 */
import { useCallback, useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { isPast, type ToyTransactionStatus } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { ListIntro, ListRow, ListSection, StagePill } from '../list/list-kit'
import { Button } from '../ui/Button'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'

type MyEvent = {
  registration_id: string
  event: {
    id: string
    org_name: string
    title: string
    starts_at: string
    ends_at: string | null
    format: 'in_person' | 'online'
    suburb: string | null
    state: string | null
    cancelled_at: string | null
  }
  part_request: { status: ToyTransactionStatus; decline_reason: string | null } | null
}

function partsLine(r: MyEvent['part_request'], org: string) {
  if (!r) return null
  if (r.status === 'accepted') return { stage: 'live' as const, pill: 'Printing', text: `${org} is printing your parts`, declined: false }
  if (r.status === 'requested')
    return { stage: 'waiting' as const, pill: 'Parts pending', text: `${org} has your part list — waiting for them to confirm`, declined: false }
  return {
    stage: 'needsyou' as const,
    pill: 'Parts declined',
    text: r.decline_reason ? `${org} cannot print your parts — ${r.decline_reason}` : `${org} cannot print your parts`,
    declined: true,
  }
}

export function MyEventsScreen() {
  const router = useRouter()
  const [rows, setRows] = useState<MyEvent[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    apiClient
      .get<MyEvent[]>('/api/events/mine')
      .then(setRows)
      .catch(() => setRows([]))
  }, [])
  useFocusEffect(load)

  async function cantMakeIt(eventId: string) {
    setError(null)
    try {
      await apiClient.delete(`/api/events/${eventId}/registrations`)
      load()
    } catch {
      setError('That did not save. Try once more.')
    }
  }

  if (!rows) {
    return (
      <Screen>
        <SkeletonRow />
        <SkeletonRow />
      </Screen>
    )
  }

  const upcoming = rows.filter((r) => !isPast(r.event.starts_at, r.event.ends_at))
  const past = rows.filter((r) => isPast(r.event.starts_at, r.event.ends_at))

  const row = (r: MyEvent, isOver: boolean) => {
    const start = new Date(r.event.starts_at)
    const parts = partsLine(r.part_request, r.event.org_name)
    const where = r.event.format === 'online' ? 'Online' : [r.event.suburb, r.event.state].filter(Boolean).join(', ')
    const cancelled = !!r.event.cancelled_at
    const canLeave = !isOver && !cancelled
    return (
      <View key={r.registration_id} style={styles.item}>
        <ListRow
          thumb={
            <View style={styles.date} accessible={false}>
              <Text style={styles.month}>{start.toLocaleDateString('en-AU', { month: 'short' })}</Text>
              <Text style={styles.day}>{start.getDate()}</Text>
            </View>
          }
          title={r.event.title}
          meta={[
            `${r.event.org_name}${where ? ` · ${where}` : ''} · ${start.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}`,
            parts?.text,
          ]
            .filter(Boolean)
            .join('\n')}
          metaLines={4}
          pill={
            cancelled ? (
              <StagePill stage="hidden" label="Cancelled" />
            ) : parts ? (
              <StagePill stage={parts.stage} label={parts.pill} />
            ) : null
          }
          dim={isOver}
        />
        {parts?.declined || canLeave ? (
          <View style={styles.actions}>
            {parts?.declined ? (
              <Button label="Pick a printer" variant="ghost" onPress={() => router.push('/printing')} style={styles.action} />
            ) : null}
            {canLeave ? (
              <Button label="Can't make it" variant="ghost" onPress={() => void cantMakeIt(r.event.id)} style={styles.action} />
            ) : null}
          </View>
        ) : null}
      </View>
    )
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ListIntro lead="What you said you are going to, and where any part-print request with the host is up to." />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {rows.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="Nothing booked yet"
            hint="Build days are the fastest way to get a toy working. An organisation's page lists theirs."
          />
        ) : (
          <>
            {upcoming.map((r) => row(r, false))}
            {past.length > 0 ? <ListSection style={styles.section}>Been and gone</ListSection> : null}
            {past.map((r) => row(r, true))}
          </>
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing(8) },
  error: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.danger, marginBottom: theme.spacing(3) },
  section: { marginTop: theme.spacing(3) },
  item: { marginBottom: theme.spacing(3) },
  // The row's photo slot, as a calendar leaf.
  date: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radii.field, backgroundColor: theme.colors.tone.brand.bg },
  month: { fontFamily: theme.fonts.black, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: theme.colors.ink },
  day: { fontFamily: theme.fonts.display, fontSize: 22, lineHeight: 24, color: theme.colors.ink },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing(1), marginTop: theme.spacing(1) },
  action: { minHeight: 44, paddingHorizontal: theme.spacing(3) },
})
