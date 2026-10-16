// packages/mobile/components/admin/idea-review-detail-screen.tsx
// One idea and the verbs that move it: publish or reject while pending,
// graduate or unpublish once it is a challenge. Mobile's half of web's
// app/admin/ideas/[id]/page.tsx. There is no single-idea admin route, so it
// reads the queue and finds the row.
import { useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { shortDate } from '@splat-connect/types'
import type { ContactPref } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { useBottomClearance } from '../../lib/bottom-clearance'
import { Screen } from '../ui/Screen'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { EmptyState } from '../ui/EmptyState'
import { ErrorRow } from '../ui/ErrorRow'
import { ListRow, ListSection, Pill } from '../list/list-kit'
import { AdminsOnly, LoadFailed, LoadingRows, adminError, useAdminLoad } from './use-admin-load'
import { IDEA_PILL, type QueuedIdea } from './ideas-review-screen'

const CONTACT: Record<ContactPref, string> = {
  clarification: 'Clarification',
  co_design: 'Co-design',
  user_testing: 'User testing',
}

export function IdeaReviewDetailScreen({ ideaId }: { ideaId: string }) {
  const router = useRouter()
  const bottom = useBottomClearance()
  const { data, loading, error, forbidden, retry } = useAdminLoad<QueuedIdea[]>('/api/admin/ideas')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const idea = data?.find((i) => i.id === ideaId)

  async function run(call: () => Promise<unknown>) {
    setBusy(true)
    setFailure(null)
    try {
      await call()
      router.back()
    } catch (err) {
      setFailure(adminError(err))
    } finally {
      setBusy(false)
    }
  }

  // The note is the only thing the author sees about why, so an empty one never reaches the API.
  function withdraw() {
    const review_note = note.trim()
    if (!review_note) {
      setFailure('Say why. The author sees this note.')
      return
    }
    void run(() => apiClient.patch(`/api/admin/ideas/${ideaId}/status`, { status: 'rejected', review_note }))
  }

  if (forbidden) {
    return (
      <Screen>
        <AdminsOnly />
      </Screen>
    )
  }
  if (loading || error || !idea) {
    return (
      <Screen>
        {loading ? (
          <LoadingRows />
        ) : error ? (
          <LoadFailed onRetry={retry} />
        ) : (
          <EmptyState icon="bulb-outline" title="That idea isn't here any more." hint="Go back to the list to see what is waiting." />
        )}
      </Screen>
    )
  }

  const pending = idea.status === 'pending'
  const published = idea.status === 'challenge'
  const canGraduate = published && idea.kind !== 'question'
  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.pills}>
          <Pill {...IDEA_PILL[idea.status]} variant="large" />
          {idea.kind === 'question' ? <Pill label="Question" bg={theme.colors.tone.sunken.bg} variant="large" /> : null}
        </View>
        <Text style={styles.title}>{idea.title}</Text>
        <Text style={styles.meta}>{`Submitted by ${idea.profiles?.name ?? 'Someone'} · ${shortDate(idea.created_at)}`}</Text>
        <Text style={styles.summary}>{idea.summary}</Text>

        {idea.description ? (
          <>
            <ListSection style={styles.section}>Why it matters</ListSection>
            <Text style={styles.body}>{idea.description}</Text>
          </>
        ) : null}

        {idea.intended_use || idea.primary_user || idea.contact_prefs.length > 0 ? (
          <>
            <ListSection style={styles.section}>Details given</ListSection>
            {idea.intended_use ? <Text style={styles.body}>{`Intended use: ${idea.intended_use}`}</Text> : null}
            {idea.primary_user ? <Text style={styles.body}>{`Who it's for: ${idea.primary_user}`}</Text> : null}
            {idea.contact_prefs.length > 0 ? (
              <Text style={styles.body}>{`Happy to be contacted for: ${idea.contact_prefs.map((p) => CONTACT[p]).join(', ')}`}</Text>
            ) : null}
          </>
        ) : null}

        {idea.status === 'rejected' ? <Text style={styles.body}>{idea.review_note ? `Rejected: ${idea.review_note}` : 'Rejected.'}</Text> : null}
        {idea.status === 'graduated' ? (
          idea.tutorial_id ? (
            <View style={styles.section}>
              <ListRow
                title="View the draft guide"
                meta="Graduated from this idea."
                onPress={() => router.push(`/admin/review/${idea.tutorial_id}`)}
              />
            </View>
          ) : (
            <Text style={styles.body}>Graduation did not complete. This idea is marked graduated, but no draft guide was created. It needs manual repair.</Text>
          )
        ) : null}

        {pending || published ? (
          <TextField
            label={pending ? 'Reason for rejecting' : 'Why is this being withdrawn?'}
            accessibilityLabel={pending ? 'Reason for rejecting' : 'Why is this being withdrawn?'}
            hint="Only the author sees this."
            multiline
            numberOfLines={3}
            style={styles.paragraph}
            value={note}
            onChangeText={setNote}
          />
        ) : null}
        <ErrorRow message={failure} />
      </ScrollView>

      {pending || published ? (
        <View style={[styles.footer, { paddingBottom: bottom }]}>
          <Button label={pending ? 'Reject' : 'Unpublish'} variant="secondary" disabled={busy} onPress={withdraw} style={styles.flex} />
          {pending ? (
            <Button
              label="Publish"
              disabled={busy}
              onPress={() => void run(() => apiClient.patch(`/api/admin/ideas/${ideaId}/status`, { status: 'challenge' }))}
              style={styles.flex}
            />
          ) : canGraduate ? (
            <Button label="Graduate to draft" disabled={busy} onPress={() => void run(() => apiClient.post(`/api/admin/ideas/${ideaId}/graduate`, {}))} style={styles.flex} />
          ) : null}
        </View>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: theme.spacing(4) },
  pills: { flexDirection: 'row', gap: 6, marginBottom: theme.spacing(3) },
  title: { fontFamily: theme.fonts.display, fontSize: theme.type.title, lineHeight: 30, color: theme.colors.ink },
  meta: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, marginTop: theme.spacing(1) },
  summary: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, lineHeight: 21, color: theme.colors.muted, marginTop: theme.spacing(3) },
  section: { marginTop: theme.spacing(5) },
  body: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, lineHeight: 21, color: theme.colors.text, marginTop: theme.spacing(2) },
  paragraph: { minHeight: 72, textAlignVertical: 'top' },
  footer: { flexDirection: 'row', gap: theme.spacing(3), borderTopWidth: theme.border.hairline, borderTopColor: theme.colors.border, paddingTop: theme.spacing(3) },
})
