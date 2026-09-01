// packages/mobile/components/challenges/submit-idea-screen.tsx
// Mobile's half of web's app/get-involved/submit-an-idea/page.tsx +
// components/idea-form.tsx: the same six fields, the same labels, the same
// required-ness, posting to the same POST /api/ideas.
//
// Title comes from the native header (app/(tabs)/explore/_layout.tsx).
import { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { CONTACT_PREFS, type ContactPref, type ToyIdea } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { useCapabilities } from '../../lib/capabilities'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { EmptyState } from '../ui/EmptyState'
import { ErrorRow } from '../auth-screen'

const CONTACT_PREF_LABELS: Record<ContactPref, string> = {
  clarification: 'Clarification',
  co_design: 'Co-design',
  user_testing: 'User testing',
}

/**
 * REPLACE BEFORE LAUNCH. Transcribed from web's submit-an-idea page, which
 * carries this same warning: it is a draft of what SPLAT will and will not
 * take on, a safety judgement the project owner has not signed off. Keep both
 * copies in step with whatever they actually decide; invent no exclusions.
 */
const SCOPE_EXCLUSIONS = [
  "Nothing load-bearing — it must never need to hold a child's weight or safety.",
  'Battery-powered only — nothing wired into the mains.',
  'Nothing that could be swallowed.',
  'Nothing medical.',
  'Nothing beyond what a volunteer can build with their own tools.',
]

// label is the accessibility name the tests and a screen reader both use;
// multiline mirrors web's textarea-vs-input split field for field.
const FIELDS = [
  { key: 'title', label: 'Idea name', multiline: false },
  { key: 'summary', label: 'Summarise it in one sentence', multiline: false },
  { key: 'description', label: 'Full description', multiline: true },
  { key: 'intended_use', label: 'Intended use', multiline: true },
  { key: 'primary_user', label: 'Primary user', multiline: true },
] as const

type FieldKey = (typeof FIELDS)[number]['key']
type Draft = Record<FieldKey, string>

const EMPTY: Draft = {
  title: '',
  summary: '',
  description: '',
  intended_use: '',
  primary_user: '',
}

/**
 * The API writes its 4xx bodies for humans and api-client folds them into the
 * thrown Error's message; 5xx keeps the fallback. Same helper, same reasoning,
 * as exchanges/thread-screen.tsx.
 */
function apiMessage(err: unknown, fallback: string): string {
  const match = /failed with status 4\d\d: (.+)$/.exec(err instanceof Error ? err.message : '')
  return match ? match[1] : fallback
}

export function SubmitIdeaScreen() {
  const router = useRouter()
  const { caps } = useCapabilities()
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [prefs, setPrefs] = useState<ContactPref[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  function togglePref(pref: ContactPref) {
    setPrefs((cur) => (cur.includes(pref) ? cur.filter((p) => p !== pref) : [...cur, pref]))
  }

  async function submit() {
    // Mirrors readIdeaBody in packages/api/src/routes/toy-ideas.ts: every
    // narrative field is required and whitespace-only is rejected. The server
    // enforces this regardless — this only saves a round trip on an empty form.
    const trimmed = Object.fromEntries(
      FIELDS.map((f) => [f.key, draft[f.key].trim()])
    ) as Draft
    if (Object.values(trimmed).some((v) => !v)) {
      setError('All fields are required')
      return
    }

    setBusy(true)
    setError(null)
    try {
      await apiClient.post<ToyIdea>('/api/ideas', { ...trimmed, contact_prefs: prefs })
      setSent(true)
    } catch (err) {
      // The draft stays: a 400 for a field the server would not take must not
      // also throw away the five paragraphs someone just wrote.
      setError(apiMessage(err, 'Could not submit this idea. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <Screen>
        <EmptyState
          icon="paper-plane-outline"
          title="Idea sent."
          hint="We check whether a guide already covers it. If it does not, it goes to the makers — and you will see it move through review under Your ideas."
        >
          {/* replace, not push: going "back" to a form that has already been
              submitted invites a second copy of the same idea. */}
          <Button
            label="See your ideas"
            variant="accent"
            onPress={() => router.replace('/challenges')}
            style={styles.sentButton}
          />
        </EmptyState>
      </Screen>
    )
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <Text style={styles.intro}>
            You do not have to be able to build something to be the person who thought of it.
            Parents and therapists spot the need long before a maker does.
          </Text>

          <Card style={styles.scope}>
            <Text style={styles.scopeTitle}>What we can&apos;t take on</Text>
            <Text style={styles.scopeHint}>
              This list is still being confirmed, so treat it as a guide rather than the final
              word. If you are unsure whether an idea fits, submit it anyway and we will tell you.
            </Text>
            {SCOPE_EXCLUSIONS.map((line) => (
              <Text key={line} style={styles.scopeLine}>
                {`· ${line}`}
              </Text>
            ))}
          </Card>

          {caps ? (
            <View style={styles.form}>
              {FIELDS.map((field) => (
                <TextField
                  key={field.key}
                  label={field.label}
                  accessibilityLabel={field.label}
                  value={draft[field.key]}
                  onChangeText={(text) => setDraft((cur) => ({ ...cur, [field.key]: text }))}
                  multiline={field.multiline}
                  style={field.multiline ? styles.multiline : undefined}
                />
              ))}

              <Text style={styles.legend}>I&apos;m happy to be contacted for…</Text>
              <View style={styles.prefRow}>
                {CONTACT_PREFS.map((pref) => (
                  <Chip
                    key={pref}
                    label={CONTACT_PREF_LABELS[pref]}
                    active={prefs.includes(pref)}
                    onPress={() => togglePref(pref)}
                  />
                ))}
              </View>

              <ErrorRow message={error} />

              <Button
                label="Submit idea"
                variant="accent"
                loading={busy}
                onPress={() => void submit()}
                style={styles.submit}
              />
            </View>
          ) : (
            // POST /api/ideas sits behind authMiddleware, so a form here would
            // only ever collect five paragraphs and then 401 on them.
            <Button
              label="Sign in to submit an idea"
              onPress={() => router.push('/sign-in')}
              style={styles.submit}
            />
          )}
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: theme.spacing(8) },
  intro: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    lineHeight: 21,
    marginBottom: theme.spacing(4),
  },
  scope: { marginBottom: theme.spacing(5), gap: theme.spacing(1) },
  scopeTitle: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.text },
  scopeHint: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    lineHeight: 18,
    marginBottom: theme.spacing(1),
  },
  scopeLine: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    lineHeight: 19,
  },
  form: { gap: theme.spacing(1) },
  multiline: { minHeight: 84, textAlignVertical: 'top' },
  legend: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  prefRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2), marginBottom: theme.spacing(2) },
  submit: { alignSelf: 'flex-start', marginTop: theme.spacing(3), paddingHorizontal: theme.spacing(6) },
  sentButton: { marginTop: theme.spacing(5), paddingHorizontal: theme.spacing(6) },
})
