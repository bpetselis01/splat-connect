// packages/mobile/components/challenges/submit-idea-screen.tsx
// Mobile's half of web's app/get-involved/submit-an-idea/page.tsx +
// components/idea-form.tsx: the board's fields: a title and a summary are
// required, why it matters is optional, posting to the same POST /api/ideas.
//
// Title comes from the native header (app/(tabs)/explore/_layout.tsx).
import { useEffect, useState } from 'react'
import { View, Text, Image, Pressable, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { apiMessage, CONTACT_PREFS, type ContactPref, type ToyIdea, type ToyIdeaKind } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { pickAndUploadPhoto, type UploadResult } from '../../lib/upload'
import { theme } from '../../lib/theme'
import { useBottomClearance } from '../../lib/bottom-clearance'
import { useCapabilities } from '../../lib/capabilities'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { EmptyState } from '../ui/EmptyState'
import { ErrorRow } from '../ui/ErrorRow'

// Web's idea-form.tsx tiles, same words (078).
const KINDS: { kind: ToyIdeaKind; label: string }[] = [
  { kind: 'challenge', label: 'A toy worth adapting' },
  { kind: 'question', label: 'A question for the community' },
]

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

// label is the accessibility name the tests and a screen reader both use.
const FIELDS = [
  { key: 'title', label: 'Idea name', multiline: false, placeholder: undefined },
  { key: 'summary', label: 'Summarise it in one sentence', multiline: false, placeholder: undefined },
  // The board's label and placeholder (MB #challenge_new). Optional (103).
  { key: 'description', label: 'Why it matters', multiline: true, placeholder: 'Who would use it, and what they cannot do today.' },
] as const

type FieldKey = (typeof FIELDS)[number]['key']
type Draft = Record<FieldKey, string>

const EMPTY: Draft = { title: '', summary: '', description: '' }

export function SubmitIdeaScreen({ from }: { from?: string } = {}) {
  const bottom = useBottomClearance()
  const router = useRouter()
  const { caps } = useCapabilities()
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [prefs, setPrefs] = useState<ContactPref[]>([])
  const [kind, setKind] = useState<ToyIdeaKind>('challenge')
  // 106: the upload's path is what the idea takes; its url is the preview.
  const [photo, setPhoto] = useState<UploadResult | null>(null)
  const [anonymous, setAnonymous] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  // "Submit a revised idea" (challenge-author-states): start from the
  // rejected one. A new idea is filed; the old one stays as it was judged.
  useEffect(() => {
    if (!from) return
    apiClient
      .get<ToyIdea>(`/api/ideas/mine/${from}`)
      .then((idea) => {
        setDraft({ title: idea.title, summary: idea.summary, description: idea.description ?? '' })
        setKind(idea.kind ?? 'challenge')
        setPrefs(idea.contact_prefs)
        setPhoto(idea.photo_path && idea.photo_url ? { path: idea.photo_path, url: idea.photo_url } : null)
        setAnonymous(idea.anonymous ?? false)
      })
      .catch(() => {})
  }, [from])

  function togglePref(pref: ContactPref) {
    setPrefs((cur) => (cur.includes(pref) ? cur.filter((p) => p !== pref) : [...cur, pref]))
  }

  async function addPhoto() {
    setError(null)
    try {
      const uploaded = await pickAndUploadPhoto('/api/upload/idea-photo', '', null)
      if (uploaded) setPhoto(uploaded)
    } catch (err) {
      setError(
        err instanceof Error && /^Photo library/.test(err.message)
          ? err.message
          : apiMessage(err, 'Could not upload the photo. Please try again.'),
      )
    }
  }

  async function submit() {
    // Mirrors readIdeaBody: a title and a summary, trimmed, are required.
    const title = draft.title.trim()
    const summary = draft.summary.trim()
    if (!title || !summary) {
      setError('A title and a summary are required.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      await apiClient.post<ToyIdea>('/api/ideas', {
        title,
        summary,
        description: draft.description.trim() || null,
        kind,
        contact_prefs: prefs,
        photo_path: photo?.path ?? null,
        anonymous,
      })
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
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: bottom }]}>
          {/* The board's words, and web's (submit-an-idea/page.tsx). */}
          <Text style={styles.intro}>
            Suggest a toy worth adapting, even if you cannot build it. An admin reads every idea.
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
              <Text style={styles.legend}>What are you sharing?</Text>
              <View accessibilityRole="radiogroup" style={styles.prefRow}>
                {KINDS.map((k) => (
                  <Chip key={k.kind} role="radio" label={k.label} active={kind === k.kind} onPress={() => setKind(k.kind)} />
                ))}
              </View>
              <Text style={styles.scopeHint}>
                {kind === 'question'
                  ? 'No build needed. People answer in the thread, and you mark the answer that helped.'
                  : 'Becomes a build challenge makers can pick up.'}
              </Text>

              {FIELDS.map((field) => (
                <TextField
                  key={field.key}
                  label={field.label}
                  accessibilityLabel={field.label}
                  value={draft[field.key]}
                  onChangeText={(text) => setDraft((cur) => ({ ...cur, [field.key]: text }))}
                  multiline={field.multiline}
                  placeholder={field.placeholder}
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

              {/* The board's words (MB #challenge_new). */}
              <Text style={styles.legend}>Photo</Text>
              <Pressable
                onPress={() => void addPhoto()}
                accessibilityRole="button"
                accessibilityLabel="Tap to add a photo"
                style={styles.photoSlot}
              >
                {photo ? (
                  <Image
                    source={{ uri: photo.url }}
                    style={styles.photo}
                    accessibilityLabel="Your photo"
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <Text style={styles.scopeHint}>Tap to add a photo</Text>
                )}
              </Pressable>
              <Pressable
                onPress={() => setAnonymous((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityLabel="Post anonymously"
                accessibilityState={{ checked: anonymous }}
                style={styles.checkRow}
              >
                <Ionicons name={anonymous ? 'checkbox' : 'square-outline'} size={22} color={theme.colors.ink} />
                <Text style={styles.checkText}>Post anonymously</Text>
              </Pressable>

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
  photoSlot: {
    height: 130,
    borderRadius: theme.radii.field,
    borderWidth: theme.border.hairline,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: theme.spacing(2),
  },
  photo: { width: '100%', height: '100%' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2), minHeight: 44 },
  checkText: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.text },
  submit: { alignSelf: 'flex-start', marginTop: theme.spacing(3), paddingHorizontal: theme.spacing(6) },
  sentButton: { marginTop: theme.spacing(5), paddingHorizontal: theme.spacing(6) },
})
