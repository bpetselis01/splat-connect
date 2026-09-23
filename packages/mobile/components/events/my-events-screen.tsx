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
import type { ToyTransactionStatus } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
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

// Same rule as web's lib/dates isPast: over once it has ended, or its day has.
const isPast = (starts: string, ends: string | null) =>
  new Date(ends ?? new Date(starts).setHours(23, 59, 59, 999)).getTime() < Date.now()

function partsLine(r: MyEvent['part_request'], org: string) {
  if (!r) return null
  if (r.status === 'accepted') return { tone: theme.colors.tone.mint, text: `${org} is printing your parts`, declined: false }
  if (r.status === 'requested')
    return { tone: theme.colors.tone.honey, text: `${org} has your part list — waiting for them to confirm`, declined: false }
  return {
    tone: theme.colors.tone.apricot,
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
    return (
      <Card key={r.registration_id} style={styles.row}>
        <View style={styles.top}>
          <View style={styles.date} accessible={false}>
            <Text style={styles.month}>{start.toLocaleDateString('en-AU', { month: 'short' })}</Text>
            <Text style={styles.day}>{start.getDate()}</Text>
          </View>
          <View style={styles.body}>
            <Text style={styles.title}>
              {r.event.title}
              {r.event.cancelled_at ? ' · Cancelled' : ''}
            </Text>
            <Text style={styles.meta}>
              {r.event.org_name}
              {where ? ` · ${where}` : ''} ·{' '}
              {start.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}
            </Text>
          </View>
        </View>
        {parts ? (
          <View style={[styles.parts, { backgroundColor: parts.tone.bg }]}>
            <Text style={styles.partsText}>{parts.text}</Text>
            {parts.declined ? (
              <Button label="Pick a printer" variant="ghost" onPress={() => router.push('/printing')} />
            ) : null}
          </View>
        ) : null}
        {!isOver && !r.event.cancelled_at ? (
          <Button label="Can't make it" variant="secondary" onPress={() => void cantMakeIt(r.event.id)} />
        ) : null}
      </Card>
    )
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lede}>
          What you said you are going to, and where any part-print request with the host is up to.
        </Text>
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
            {past.length > 0 ? <Text style={styles.section}>Been and gone</Text> : null}
            {past.map((r) => row(r, true))}
          </>
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { gap: theme.spacing(3), paddingBottom: theme.spacing(8) },
  lede: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, lineHeight: 21, marginBottom: theme.spacing(1) },
  error: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.danger },
  section: { fontFamily: theme.fonts.display, fontSize: theme.type.heading, color: theme.colors.text, marginTop: theme.spacing(3) },
  row: { padding: theme.spacing(4), gap: theme.spacing(3) },
  top: { flexDirection: 'row', gap: theme.spacing(3), alignItems: 'flex-start' },
  date: { width: 56, alignItems: 'center', paddingVertical: theme.spacing(2), borderRadius: theme.radii.field, backgroundColor: theme.colors.tone.brand.bg },
  month: { fontFamily: theme.fonts.black, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: theme.colors.ink },
  day: { fontFamily: theme.fonts.display, fontSize: 24, lineHeight: 26, color: theme.colors.ink },
  body: { flex: 1, gap: theme.spacing(1) },
  title: { fontFamily: theme.fonts.display, fontSize: theme.type.body, color: theme.colors.text },
  meta: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.muted },
  parts: { borderRadius: theme.radii.field, padding: theme.spacing(3), gap: theme.spacing(1) },
  partsText: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.ink },
})
