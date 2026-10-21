// packages/mobile/components/events/event-detail-screen.tsx
/**
 * One event, on the phone: what, when, where, what it costs, how full it is,
 * and the one action that fits the viewer.
 *
 * Reads GET /api/public/events/:id, so a guest can read it. The button is the
 * decision: a guest signs in and comes back, an event with questions or a cost
 * opens the register screen (the cost needs its tick box), and any other event
 * is a single POST, as web's event-rsvp-button does. Someone already going gets
 * "Can't make it".
 *
 * An online event's joining link is never in this payload; the API strips it.
 */
import { useCallback, useState } from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import {
  apiMessage, EVENT_KIND_LABEL, formatCents, formatTimeRange, isPast, longDate, type EventKind,
} from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { useAuth } from '../../lib/auth-context'
import { useCapabilities } from '../../lib/capabilities'
import { type EventDetail, eventPath } from '../../lib/events'
import { setReturnTo } from '../../lib/return-to'
import { theme } from '../../lib/theme'
import { useBottomClearance } from '../../lib/bottom-clearance'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Meter } from '../ui/Meter'
import { InitialsStack } from '../ui/InitialsStack'
import { EmptyState } from '../ui/EmptyState'
import { ErrorRow } from '../ui/ErrorRow'
import { SkeletonRow } from '../ui/Skeleton'
import { ListSection, Pill } from '../list/list-kit'

type Icon = React.ComponentProps<typeof Ionicons>['name']

const KIND_ICON: Record<EventKind, Icon> = {
  build_day: 'hammer-outline',
  workshop: 'construct-outline',
  open_day: 'storefront-outline',
  print_day: 'print-outline',
}

// The mockup draws five discs and a "+N"; the API sends at most eight initials.
const SHOWN = 5

function Fact({ icon, tint, title, sub }: { icon: Icon; tint: string; title: string; sub?: string | null }) {
  return (
    <View style={styles.fact}>
      <View style={[styles.factIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={18} color={theme.colors.ink} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.factTitle}>{title}</Text>
        {sub ? <Text style={styles.factSub}>{sub}</Text> : null}
      </View>
    </View>
  )
}

export function EventDetailScreen({ id }: { id: string }) {
  const router = useRouter()
  const { session } = useAuth()
  const { caps, loading: capsLoading } = useCapabilities()
  const bottom = useBottomClearance()
  const [event, setEvent] = useState<EventDetail | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const viewerId = session?.user.id ?? null

  const load = useCallback(() => {
    apiClient
      .get<EventDetail>(eventPath(id, viewerId))
      .then((e) => {
        setEvent(e)
        setState('ready')
      })
      .catch((err: { status?: number }) => {
        // Kept if we already have it: a refresh that fails offline should not wipe the page.
        setState((s) => (err?.status === 404 ? 'missing' : s === 'ready' ? 'ready' : 'failed'))
      })
  }, [id, viewerId])
  // Focus, not mount: coming back from the register screen shows "Can't make it".
  useFocusEffect(load)

  if (state === 'loading') {
    return (
      <Screen>
        <SkeletonRow />
        <SkeletonRow />
      </Screen>
    )
  }
  if (state === 'missing') {
    return (
      <Screen>
        <EmptyState icon="calendar-outline" title="No such event." hint="It may have been taken down." />
      </Screen>
    )
  }
  if (!event) {
    return (
      <Screen>
        <EmptyState icon="cloud-offline-outline" title="Could not load this event." hint="Check your connection and try again.">
          <Button label="Try again" variant="secondary" onPress={load} />
        </EmptyState>
      </Screen>
    )
  }

  const past = isPast(event.starts_at, event.ends_at)
  const cancelled = !!event.cancelled_at
  const closed = !!event.registrations_closed_at
  const full = event.seats_left === 0
  const online = event.format === 'online'
  const going = event.viewer_going
  const cost = event.cost_cents && event.cost_cents > 0 ? event.cost_cents : null
  const open = !past && !cancelled
  const hostName = event.org?.name ?? 'The host'
  const place = [event.suburb, event.state].filter(Boolean).join(', ')
  const profile = caps?.profile
  const needsForm = event.questions.length > 0 || !!cost || !profile?.name || !profile?.email

  async function act(run: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await run()
      load()
    } catch (err) {
      setError(apiMessage(err, 'That did not save. Try once more.'))
    } finally {
      setBusy(false)
    }
  }

  function imGoing() {
    if (!session) {
      setReturnTo(`/events/${id}`)
      return router.push('/sign-in')
    }
    if (needsForm) return router.push(`/events/${id}/register` as never)
    void act(() => apiClient.post(`/api/events/${id}/registrations`, { name: profile!.name, email: profile!.email, answers: {} }))
  }

  const seatsPill = full
    ? { label: 'This one is full', bg: theme.colors.dangerSoft, icon: 'close-circle-outline' as Icon }
    : event.seats_left !== null
      ? { label: `${event.seats_left} ${event.seats_left === 1 ? 'seat' : 'seats'} left`, bg: theme.colors.honeySoft, icon: 'people-outline' as Icon }
      : { label: 'Everyone is welcome', bg: theme.colors.honeySoft, icon: 'people-outline' as Icon }
  const shown = event.attendee_initials.slice(0, SHOWN)

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: theme.spacing(4) }}>
        <View style={styles.pills}>
          <Pill label={EVENT_KIND_LABEL[event.kind]} bg={theme.colors.tone.brand.bg} icon={KIND_ICON[event.kind]} />
          <Pill label={online ? 'Online' : 'In person'} bg={theme.colors.tone.sunken.bg} icon={online ? 'videocam-outline' : 'location-outline'} />
          {going && open ? <Pill label="You're going" bg={theme.colors.mintSoft} icon="checkmark-circle-outline" /> : null}
          {past ? <Pill label="Past event" bg={theme.colors.tone.sunken.bg} /> : null}
        </View>
        <Text accessibilityRole="header" style={styles.title}>{event.title}</Text>
        {event.org ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Hosted by ${event.org.name}. Open their page.`}
            onPress={() => router.push(`/toy-library/organisation/${event.org!.id}` as never)}
            style={styles.host}
          >
            <View style={styles.hostGlyph}>
              <Ionicons name="business-outline" size={16} color={theme.colors.primaryDeep} />
            </View>
            <Text style={styles.hostText}>Hosted by </Text>
            <Text style={styles.hostName}>{event.org.name}</Text>
          </Pressable>
        ) : null}

        <Card style={styles.facts}>
          <Fact
            icon="calendar-outline"
            tint={theme.colors.honeySoft}
            title={longDate(event.starts_at)}
            sub={formatTimeRange(event.starts_at, event.ends_at, event.format)}
          />
          <Fact
            icon={online ? 'videocam-outline' : 'location-outline'}
            tint={theme.colors.mintSoft}
            title={online ? 'Online' : (event.location ?? place)}
            sub={online ? 'The joining link is sent to you once you say you are coming.' : place}
          />
          <Fact
            icon="wallet-outline"
            tint={theme.colors.apricotSoft}
            title={cost ? `${formatCents(cost)} towards materials` : 'Free to attend'}
            sub={cost ? event.cost_note : null}
          />
        </Card>

        {cancelled ? (
          <View style={styles.capacity}>
            <Pill label="Cancelled by the host" bg={theme.colors.dangerSoft} icon="close-circle-outline" variant="large" />
          </View>
        ) : past ? (
          <Text style={[styles.body, styles.capacity]}>This one has already happened.</Text>
        ) : (
          <View style={styles.capacity}>
            <View style={styles.capacityTop}>
              <Pill label={seatsPill.label} bg={seatsPill.bg} icon={seatsPill.icon} variant="large" />
              {event.capacity !== null ? (
                <Text style={styles.capacityMeta}>{event.going_count} of {event.capacity} seats taken</Text>
              ) : null}
            </View>
            {event.capacity !== null ? (
              <Meter value={event.going_count} max={event.capacity} width="100%" label={`${event.going_count} of ${event.capacity} seats taken`} />
            ) : null}
            {closed ? <Text style={styles.capacityMeta}>The host has closed registrations for this one.</Text> : null}
          </View>
        )}

        {event.going_count > 0 ? (
          <>
            <ListSection style={styles.section}>{event.going_count} going</ListSection>
            <InitialsStack initials={shown} more={event.going_count - shown.length} />
          </>
        ) : null}

        {event.description ? (
          <>
            <ListSection style={styles.section}>About</ListSection>
            {event.description.split(/\n{2,}/).map((para, i) => (
              <Text key={i} style={[styles.body, i > 0 && styles.para]}>{para}</Text>
            ))}
          </>
        ) : null}
        {event.audience ? (
          <>
            <ListSection style={styles.section}>Who it is for</ListSection>
            <Text style={styles.body}>{event.audience}</Text>
          </>
        ) : null}
        {event.what_to_bring ? (
          <>
            <ListSection style={styles.section}>What to bring</ListSection>
            <Text style={styles.body}>{event.what_to_bring}</Text>
          </>
        ) : null}
        {event.tools.length > 0 || event.prints_parts ? (
          <>
            <ListSection style={styles.section}>On the bench</ListSection>
            {event.tools.length > 0 ? (
              <View style={styles.tools}>
                {event.tools.map((t) => (
                  <Pill key={t} label={t} bg={theme.colors.tone.sunken.bg} />
                ))}
              </View>
            ) : null}
            {event.prints_parts ? (
              <Text style={styles.body}>
                {hostName} can print a guide's parts for you before the day, up to {event.part_sets_max} sets.
              </Text>
            ) : null}
          </>
        ) : null}
        {event.accessibility_note ? (
          <>
            <ListSection style={styles.section}>Access</ListSection>
            <Text style={styles.body}>{event.accessibility_note}</Text>
          </>
        ) : null}
      </ScrollView>

      {open ? (
        <View style={[styles.footer, { paddingBottom: bottom }]}>
          <ErrorRow message={error} />
          {going ? (
            <Button label="Can't make it" variant="secondary" loading={busy} onPress={() => void act(() => apiClient.delete(`/api/events/${id}/registrations`))} />
          ) : closed ? (
            <Button label="Registrations are closed" variant="secondary" disabled onPress={() => {}} />
          ) : full ? (
            <Button label="This one is full" variant="secondary" disabled onPress={() => {}} />
          ) : (
            <Button label="I'm going" loading={busy || capsLoading} onPress={imGoing} />
          )}
          {event.prints_parts && session ? (
            <Button
              label="Print parts here"
              variant="ghost"
              onPress={() => router.push(`/events/${id}/print` as never)}
              style={styles.print}
            />
          ) : null}
        </View>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: theme.spacing(3) },
  title: { fontFamily: theme.fonts.display, fontSize: theme.type.title, lineHeight: 30, color: theme.colors.ink },
  host: { flexDirection: 'row', alignItems: 'center', minHeight: 44, marginTop: theme.spacing(1), marginBottom: theme.spacing(4) },
  hostGlyph: { width: 28, height: 28, borderRadius: theme.radii.pill, backgroundColor: theme.colors.accentLight, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  hostText: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted },
  hostName: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.primaryDeep },
  facts: { gap: 16 },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  factIcon: { width: 36, height: 36, borderRadius: theme.radii.pill, alignItems: 'center', justifyContent: 'center' },
  factTitle: { fontFamily: theme.fonts.black, fontSize: theme.type.body, lineHeight: 20, color: theme.colors.ink, marginTop: 1 },
  factSub: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, lineHeight: 18, color: theme.colors.muted, marginTop: 2 },
  capacity: { marginTop: theme.spacing(4), gap: 10 },
  capacityTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  capacityMeta: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.muted },
  section: { marginTop: theme.spacing(6) },
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: theme.spacing(2) },
  body: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, lineHeight: 21, color: theme.colors.text },
  para: { marginTop: theme.spacing(2) },
  footer: { borderTopWidth: theme.border.hairline, borderTopColor: theme.colors.border, paddingTop: theme.spacing(3) },
  print: { minHeight: 44, marginTop: theme.spacing(1) },
})
