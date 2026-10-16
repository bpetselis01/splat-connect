// packages/mobile/components/events/event-register-screen.tsx
/**
 * Register for an event, answering the organiser's questions.
 *
 * Port of web's event-register-form. Name and email are columns, not
 * questions, and are prefilled from the profile. Required answers block the
 * confirm button; the server holds the same line, so its sentences (full,
 * closed, a bad number) are shown word for word. A costed event adds a tick
 * box, because the API refuses a costed registration without it.
 */
import { useState } from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback } from 'react'
import { apiMessage, formatCents, formatTimeRange, type OrgEventQuestion } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { useAuth } from '../../lib/auth-context'
import { useCapabilities } from '../../lib/capabilities'
import { type EventDetail, eventPath } from '../../lib/events'
import { theme } from '../../lib/theme'
import { useBottomClearance } from '../../lib/bottom-clearance'
import { Screen } from '../ui/Screen'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { ErrorRow } from '../ui/ErrorRow'
import { RequiredPill } from '../ui/RequiredPill'
import { EmptyState } from '../ui/EmptyState'
import { SkeletonRow } from '../ui/Skeleton'
import { ListRow, ListSection } from '../list/list-kit'

type Answers = Record<string, string | boolean>

function Ask({ q, children }: { q: OrgEventQuestion; children: React.ReactNode }) {
  return (
    <View>
      <View style={styles.askLabel}>
        <Text style={styles.label}>{q.prompt}</Text>
        {q.required ? <RequiredPill /> : null}
      </View>
      {children}
    </View>
  )
}

function Answer({ q, value, onChange }: { q: OrgEventQuestion; value: string | boolean | undefined; onChange: (v: string | boolean) => void }) {
  if (q.answer_type === 'choice' || q.answer_type === 'boolean') {
    const picks: Array<{ label: string; value: string | boolean }> =
      q.answer_type === 'choice'
        ? q.options.map((o) => ({ label: o, value: o }))
        : [{ label: 'Yes', value: true }, { label: 'No', value: false }]
    return (
      <View accessibilityRole="radiogroup" style={styles.chips}>
        {picks.map((o) => (
          <Chip key={o.label} role="radio" label={o.label} active={value === o.value} onPress={() => onChange(o.value)} />
        ))}
      </View>
    )
  }
  const paragraph = q.answer_type === 'paragraph'
  return (
    <TextField
      accessibilityLabel={q.prompt}
      value={String(value ?? '')}
      onChangeText={onChange}
      multiline={paragraph}
      numberOfLines={paragraph ? 4 : 1}
      style={paragraph ? styles.paragraph : undefined}
      keyboardType={q.answer_type === 'number' ? 'number-pad' : 'default'}
      maxLength={2000}
      placeholder={q.required ? undefined : 'Optional'}
    />
  )
}

function RegisterForm({ event, defaultName, defaultEmail }: { event: EventDetail; defaultName: string; defaultEmail: string }) {
  const router = useRouter()
  const bottom = useBottomClearance()
  const [name, setName] = useState(defaultName)
  const [email, setEmail] = useState(defaultEmail)
  const [answers, setAnswers] = useState<Answers>({})
  const [acknowledged, setAcknowledged] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const orgName = event.org?.name ?? 'the host'
  const cost = event.cost_cents && event.cost_cents > 0 ? event.cost_cents : null
  const start = new Date(event.starts_at)
  const where = event.format === 'online' ? 'Online' : [event.suburb, event.state].filter(Boolean).join(', ')
  const missing = event.questions.filter((q) => {
    const v = answers[q.id]
    return q.required && (v === undefined || v === '' || (typeof v === 'string' && !v.trim()))
  })
  const blocked = !name.trim() || !email.trim() || missing.length > 0 || (!!cost && !acknowledged)

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await apiClient.post(`/api/events/${event.id}/registrations`, {
        name,
        email,
        answers,
        ...(cost ? { cost_acknowledged: acknowledged } : {}),
      })
      router.replace('/events')
    } catch (err) {
      setError(apiMessage(err, 'That did not save. Try once more.'))
      setBusy(false)
    }
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: theme.spacing(4) }}>
        <View style={styles.summary}>
          <ListRow
            thumb={
              <View style={styles.date} accessible={false}>
                <Text style={styles.month}>{start.toLocaleDateString('en-AU', { month: 'short' })}</Text>
                <Text style={styles.day}>{start.getDate()}</Text>
              </View>
            }
            title={event.title}
            meta={`${[orgName, where].filter(Boolean).join(' · ')}\n${formatTimeRange(event.starts_at, event.ends_at, event.format)}`}
            metaLines={3}
          />
        </View>

        <ListSection>Your details</ListSection>
        <TextField label="Your name" value={name} onChangeText={setName} maxLength={120} autoComplete="name" />
        <TextField
          label="Email"
          hint="The host sends your confirmation here."
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />

        {event.questions.length > 0 ? (
          <>
            <ListSection style={styles.group}>Questions from {orgName}</ListSection>
            {event.questions.map((q) => (
              <Ask key={q.id} q={q}>
                <Answer q={q} value={answers[q.id]} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
              </Ask>
            ))}
          </>
        ) : (
          <Text style={styles.meta}>{orgName} asks nothing else. Your name and email are enough.</Text>
        )}

        {cost ? (
          <>
            <ListSection style={styles.group}>Cost</ListSection>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acknowledged }}
              accessibilityLabel={`I know this costs ${formatCents(cost)}`}
              onPress={() => setAcknowledged((a) => !a)}
              style={[styles.part, acknowledged && styles.agreeOn]}
            >
              <Ionicons name={acknowledged ? 'checkbox' : 'square-outline'} size={24} color={acknowledged ? theme.colors.success : theme.colors.muted} />
              <View style={styles.flex}>
                <Text style={styles.partName}>I know this costs {formatCents(cost)}</Text>
                <Text style={styles.meta}>
                  {event.cost_note ?? `I pay ${orgName} directly. SPLAT does not take the payment.`}
                </Text>
              </View>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: bottom }]}>
        <ErrorRow message={error} />
        {missing.length > 0 ? (
          <Text style={styles.hint}>
            {missing.length} required {missing.length === 1 ? 'question' : 'questions'} still to answer.
          </Text>
        ) : null}
        <Button label="Confirm my spot" loading={busy} disabled={blocked} onPress={() => void confirm()} />
      </View>
    </Screen>
  )
}

export function EventRegisterScreen({ id }: { id: string }) {
  const { session } = useAuth()
  const { caps } = useCapabilities()
  const [event, setEvent] = useState<EventDetail | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading')
  const load = useCallback(() => {
    apiClient
      .get<EventDetail>(eventPath(id, session?.user.id))
      .then((e) => {
        setEvent(e)
        setState('ready')
      })
      .catch((err: { status?: number }) => setState(err?.status === 404 ? 'missing' : 'failed'))
  }, [id, session?.user.id])
  useFocusEffect(load)

  if (state === 'missing') {
    return (
      <Screen>
        <EmptyState icon="calendar-outline" title="No such event." hint="It may have been taken down." />
      </Screen>
    )
  }
  if (state === 'failed') {
    return (
      <Screen>
        <EmptyState icon="cloud-offline-outline" title="Could not load this event." hint="Check your connection and try again.">
          <Button label="Try again" variant="secondary" onPress={load} />
        </EmptyState>
      </Screen>
    )
  }
  // The form's fields start from the profile, so wait for it rather than render blanks that then jump.
  if (!event || !caps) {
    return (
      <Screen>
        <SkeletonRow />
        <SkeletonRow />
      </Screen>
    )
  }
  if (event.cancelled_at || event.registrations_closed_at) {
    return (
      <Screen>
        <EmptyState
          icon="close-circle-outline"
          title="You cannot register for this one."
          hint={event.cancelled_at ? 'This event has been cancelled.' : 'The host has closed registrations for this one.'}
        />
      </Screen>
    )
  }
  return <RegisterForm event={event} defaultName={caps.profile.name ?? ''} defaultEmail={caps.profile.email ?? ''} />
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  summary: { marginBottom: theme.spacing(5) },
  date: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radii.field, backgroundColor: theme.colors.tone.brand.bg },
  month: { fontFamily: theme.fonts.black, fontSize: theme.type.micro, letterSpacing: 0.8, textTransform: 'uppercase', color: theme.colors.ink },
  day: { fontFamily: theme.fonts.display, fontSize: theme.type.title, lineHeight: 24, color: theme.colors.ink },
  group: { marginTop: theme.spacing(3) },
  askLabel: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: theme.spacing(2), marginBottom: theme.spacing(2) },
  label: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2), marginBottom: theme.spacing(4) },
  paragraph: { minHeight: 96, textAlignVertical: 'top' },
  part: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), padding: theme.spacing(4), minHeight: 60,
    borderRadius: theme.radii.panel, borderWidth: theme.border.hairline, borderColor: theme.colors.border, backgroundColor: theme.colors.surface,
  },
  agreeOn: { borderColor: theme.colors.success, backgroundColor: theme.colors.mintSoft },
  partName: { fontFamily: theme.fonts.black, fontSize: theme.type.body, color: theme.colors.ink },
  meta: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, lineHeight: 18, color: theme.colors.muted, marginTop: 2 },
  hint: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.muted, marginBottom: theme.spacing(2) },
  footer: { borderTopWidth: theme.border.hairline, borderTopColor: theme.colors.border, paddingTop: theme.spacing(3) },
})
