// packages/mobile/components/organisation/event-registrations-screen.tsx
/**
 * Manage one event — web's /dashboard/org/events/[id]. The part-print requests
 * come first (each has a family waiting on a yes or a no), then who is coming
 * with their answers. A print decline needs a reason by API contract, so the
 * reason field opens before anything is sent. The CSV export stays on web: a
 * file download on a phone has no destination.
 */
import { logFailure } from '../../lib/log'
import { useCallback, useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useFocusEffect } from 'expo-router'
import {
  apiMessage,
  EVENT_KIND_LABEL,
  isApiError,
  isNetworkError,
  longDate,
  shortDate,
  type OrgEvent,
  type OrgEventQuestion,
  type OrgEventRegistration,
  type ToyTransactionSummary,
} from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { useActingOrg } from '../../lib/acting-org'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { ErrorRow } from '../ui/ErrorRow'
import { EmptyState } from '../ui/EmptyState'
import { SkeletonRow } from '../ui/Skeleton'
import { ListRow, Pill, RowThumb } from '../list/list-kit'

type Data = {
  event: OrgEvent | null
  questions: OrgEventQuestion[]
  registrations: OrgEventRegistration[]
  parts: ToyTransactionSummary[]
}

const answerText = (v: string | number | boolean | undefined) =>
  v === undefined || String(v).trim() === '' ? null : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)

const SETTLED: Record<string, string> = { accepted: 'Printing', completed: 'Printed', withdrawn: 'Withdrawn' }

export function EventRegistrationsScreen({ eventId }: { eventId: string }) {
  const { org, loading: orgLoading } = useActingOrg()
  const [data, setData] = useState<Data | null>(null)
  const [failed, setFailed] = useState<'forbidden' | 'offline' | 'other' | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [declining, setDeclining] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useFocusEffect(
    useCallback(() => {
      if (!org) return
      let ignore = false
      Promise.all([
        apiClient.get<OrgEvent[]>(`/api/organizations/${org.id}/events`),
        apiClient.get<OrgEventQuestion[]>(`/api/organizations/${org.id}/events/${eventId}/questions`),
        apiClient.get<OrgEventRegistration[]>(`/api/organizations/${org.id}/events/${eventId}/registrations`),
        apiClient.get<ToyTransactionSummary[]>('/api/toy-transactions?role=owner'),
      ])
        .then(([events, questions, registrations, inbox]) => {
          if (ignore) return
          setFailed(null)
          setData({
            event: events.find((e) => e.id === eventId) ?? null,
            questions,
            registrations,
            parts: inbox.filter((t) => t.event_id === eventId),
          })
        })
        .catch((err) => {
          logFailure('[EventRegistrationsScreen] load failed:', err)
          if (ignore) return
          setFailed(isApiError(err) && err.status === 403 ? 'forbidden' : isNetworkError(err) ? 'offline' : 'other')
        })
      return () => {
        ignore = true
      }
    }, [org, eventId, reloadKey])
  )

  async function act(id: string, action: 'accept' | 'reject', why?: string) {
    setError(null)
    setBusy(id)
    try {
      await apiClient.post(`/api/toy-transactions/${id}/${action}`, why ? { reason: why } : {})
      setDeclining(null)
      setReason('')
      setReloadKey((k) => k + 1)
    } catch (err) {
      setError(apiMessage(err, 'That did not save. Try once more.'))
    } finally {
      setBusy(null)
    }
  }

  if (failed === 'forbidden') {
    return (
      <Screen>
        <EmptyState icon="lock-closed-outline" title="Leaders only" hint="Only leaders of this organisation can see who registered." />
      </Screen>
    )
  }
  if (failed && !data) {
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title={failed === 'offline' ? 'You seem to be offline.' : "Couldn't load this event."}
          hint="Check your connection and try again."
        >
          <Button
            label="Try again"
            variant="secondary"
            onPress={() => {
              setFailed(null)
              setReloadKey((k) => k + 1)
            }}
          />
        </EmptyState>
      </Screen>
    )
  }
  if (orgLoading || !data) {
    return (
      <Screen>
        <SkeletonRow />
        <SkeletonRow />
      </Screen>
    )
  }
  const { event, questions, registrations, parts } = data
  if (!event) {
    return (
      <Screen>
        <EmptyState icon="calendar-outline" title="That event isn't here any more." />
      </Screen>
    )
  }

  const rows = [...parts.filter((p) => p.status === 'requested'), ...parts.filter((p) => p.status !== 'requested')]
  const toAnswer = parts.filter((p) => p.status === 'requested').length
  const acceptedSets = parts.filter((p) => p.status === 'accepted').reduce((n, p) => n + (p.part_sets ?? 0), 0)
  const stats = [
    `${registrations.length} going`,
    `Seats ${event.capacity ?? 'no limit'}`,
    ...(event.prints_parts ? [`${toAnswer} to answer`] : []),
  ]

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={styles.kicker}>
            {EVENT_KIND_LABEL[event.kind]} · {event.starts_at ? longDate(event.starts_at) : 'No date yet'}
          </Text>
          <Text style={styles.title} accessibilityRole="header">
            {event.title}
          </Text>
        </View>
        <View style={styles.pills}>
          {stats.map((s) => (
            <Pill key={s} label={s} bg={theme.colors.mintSoft} />
          ))}
        </View>
        <ErrorRow message={error} />

        {event.prints_parts ? (
          <View style={styles.section}>
            <Text style={styles.h2} accessibilityRole="header">
              Parts to print before the day
            </Text>
            <Text style={styles.note}>
              Accept what you can. Anyone you decline is told straight away and asked to pick a printer nearby. You said up to{' '}
              {event.part_sets_max} sets; {acceptedSets} accepted so far.
            </Text>
            {rows.length === 0 ? (
              <EmptyState icon="print-outline" title="No part requests yet." />
            ) : (
              rows.map((r) => {
                const who = r.requester_name ?? 'A family'
                const detail = `${r.tutorial_title ?? 'Printable parts'} · ${r.part_sets} set${r.part_sets === 1 ? '' : 's'}${
                  r.print_note ? ` · “${r.print_note}”` : ''
                }${r.decline_reason ? ` · ${r.decline_reason}` : ''}`
                return (
                  <Card key={r.id} style={styles.card}>
                    <Text style={styles.name}>{who}</Text>
                    <Text style={styles.meta}>{detail}</Text>
                    {r.status !== 'requested' ? (
                      <Pill
                        label={SETTLED[r.status] ?? 'Declined'}
                        bg={r.status === 'accepted' || r.status === 'completed' ? theme.colors.successSoft : theme.colors.surfaceSunken}
                      />
                    ) : declining === r.id ? (
                      <View style={styles.gap}>
                        <TextField
                          label="Why can you not print these?"
                          hint="The family sees this."
                          value={reason}
                          onChangeText={setReason}
                          multiline
                        />
                        <View style={styles.actions}>
                          <Button label="Cancel" variant="ghost" onPress={() => setDeclining(null)} />
                          <Button
                            label="Send decline"
                            disabled={busy === r.id || !reason.trim()}
                            accessibilityLabel={`Send decline to ${who}`}
                            onPress={() => void act(r.id, 'reject', reason.trim())}
                          />
                        </View>
                      </View>
                    ) : (
                      <View style={styles.actions}>
                        <Button
                          label="Can't print these"
                          variant="secondary"
                          disabled={busy === r.id}
                          accessibilityLabel={`Can't print these for ${who}`}
                          onPress={() => {
                            setError(null)
                            setReason('')
                            setDeclining(r.id)
                          }}
                        />
                        <Button
                          label="We'll print these"
                          disabled={busy === r.id}
                          accessibilityLabel={`We'll print these for ${who}`}
                          onPress={() => void act(r.id, 'accept')}
                        />
                      </View>
                    )}
                  </Card>
                )
              })
            )}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.h2} accessibilityRole="header">
            Who is coming
          </Text>
          <Text style={styles.note}>
            {registrations.length} registered · {questions.length} question{questions.length === 1 ? '' : 's'} on your form. Answers are
            shown to leaders only. Export to CSV is on the web dashboard.
          </Text>
          {registrations.length === 0 ? (
            <EmptyState icon="people-outline" title="Nobody has registered yet." hint="Registrations show up here as families sign up." />
          ) : (
            registrations.map((r) => (
              <View key={r.id} style={styles.item}>
                <ListRow
                  thumb={<RowThumb glyph="person-outline" tint={theme.colors.honeySoft} />}
                  title={r.name}
                  meta={`Registered ${shortDate(r.created_at)}`}
                  onPress={() => setOpen(open === r.id ? null : r.id)}
                  accessibilityLabel={`${r.name}, ${open === r.id ? 'hide' : 'show'} answers`}
                />
                {open === r.id ? (
                  <Card style={styles.answers}>
                    {questions.length === 0 ? (
                      <Text style={styles.meta}>No questions on this form.</Text>
                    ) : (
                      questions.map((q) => (
                        <View key={q.id} style={styles.answer}>
                          <Text style={styles.prompt}>{q.prompt}</Text>
                          <Text style={styles.value}>{answerText(r.answers[q.id]) ?? 'No answer'}</Text>
                        </View>
                      ))
                    )}
                  </Card>
                ) : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { gap: theme.spacing(3), paddingBottom: theme.spacing(8) },
  kicker: { fontFamily: theme.fonts.black, fontSize: theme.type.caption, color: theme.colors.muted },
  title: { fontFamily: theme.fonts.black, fontSize: theme.type.title, color: theme.colors.ink, marginTop: theme.spacing(1) },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  section: { gap: theme.spacing(3), marginTop: theme.spacing(3) },
  h2: { fontFamily: theme.fonts.black, fontSize: theme.type.body, color: theme.colors.ink },
  note: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, lineHeight: 19, color: theme.colors.muted },
  card: { padding: 15, gap: 4, borderRadius: theme.radii.panel, ...theme.shadow(1) },
  name: { fontFamily: theme.fonts.black, fontSize: theme.type.body, color: theme.colors.ink },
  meta: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, lineHeight: 18, color: theme.colors.muted },
  gap: { gap: theme.spacing(2) },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: theme.spacing(2), marginTop: theme.spacing(2) },
  item: { gap: theme.spacing(2) },
  answers: { padding: 15, gap: theme.spacing(3), borderRadius: theme.radii.panel },
  answer: { gap: 2 },
  prompt: { fontFamily: theme.fonts.black, fontSize: theme.type.caption, color: theme.colors.muted },
  value: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.body, color: theme.colors.ink },
})
