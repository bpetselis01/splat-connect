// packages/mobile/components/guides/community-notes.tsx
//
// The board's Community notes: Revisions (pinned) and Discussion, and Add a
// note against a step or as a Missing step, with an optional photo. Pin and
// Unpin for the guide's contributors, Delete on your own note, Report a
// problem on anyone else's.
import { useState } from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import type { GuideNote, TutorialStep } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { uploadFile } from '../../lib/upload'
import { relativeTime } from '../../lib/notifications'
import { stepLabel } from '../../lib/guide-notes'
import { theme } from '../../lib/theme'
import { Section } from '../ui/Section'
import { Chip } from '../ui/Chip'
import { TextField } from '../ui/TextField'
import { Button } from '../ui/Button'
import { ErrorRow } from '../ui/ErrorRow'
import { FlashLine, useFlash } from '../ui/Flash'
import { ReportProblem } from '../reports/report-problem'

type Props = {
  tutorialId: string
  guideTitle: string
  authorName: string
  steps: TutorialStep[]
  notes: GuideNote[]
  reload: () => Promise<unknown>
  canPin: boolean
  viewerId: string | null
}

export function CommunityNotes({ tutorialId, guideTitle, authorName, steps, notes, reload, canPin, viewerId }: Props) {
  const [at, setAt] = useState<number | null | undefined>(undefined)
  const [body, setBody] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useFlash()
  const pinned = notes.filter((n) => n.pinned_at)
  const open = notes.filter((n) => !n.pinned_at)

  async function addPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) return setError('Photo library access is needed to choose a photo.')
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] })
    const asset = result.canceled ? null : result.assets?.[0]
    if (!asset) return
    try {
      const { path } = await uploadFile('/api/upload/note-photo', tutorialId, { uri: asset.uri, name: asset.fileName ?? 'photo.jpg', mimeType: asset.mimeType ?? 'image/jpeg' })
      setPhoto(path ?? null)
    } catch {
      setError('Could not upload the photo. Please try again.')
    }
  }

  async function post() {
    setBusy(true)
    setError(null)
    try {
      await apiClient.post(`/api/tutorials/${tutorialId}/notes`, { step_position: at ?? null, body: body.trim(), photo_path: photo, photo_caption: caption.trim() || null })
      setBody('')
      setPhoto(null)
      setCaption('')
      setAt(undefined)
      await reload()
    } catch (err) {
      const detail = err instanceof Error ? /status \d+: (.+)$/.exec(err.message)?.[1] : null
      setError(detail ?? 'Could not post that. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function act(path: string, done: string, method: 'post' | 'delete' = 'post') {
    try {
      if (method === 'post') await apiClient.post(path, {})
      else await apiClient.delete(path)
      setFlash(done)
      await reload()
    } catch {
      setFlash('That did not work. Try again.')
    }
  }

  const noteRow = (n: GuideNote) => (
    <View key={n.id} style={[styles.note, n.pinned_at && styles.pinnedNote]}>
      <Text style={styles.meta}>{`${stepLabel(n, steps.length)} · ${n.author_name} · ${relativeTime(n.created_at)}`}</Text>
      <Text style={styles.body}>{n.body}</Text>
      {n.photo_url ? <Image source={{ uri: n.photo_url }} style={styles.photo} accessibilityLabel={n.photo_caption ?? 'Photo with the note'} /> : null}
      {n.photo_caption ? <Text style={styles.meta}>{n.photo_caption}</Text> : null}
      <View style={styles.actions}>
        {n.pinned_at ? <Text style={styles.pinnedBy}>{`Pinned by ${n.pinned_by_name ?? 'Deleted member'}`}</Text> : null}
        {canPin ? (
          <Button
            label={n.pinned_at ? 'Unpin' : 'Pin as revision'}
            variant="ghost"
            onPress={() =>
              void act(`/api/tutorials/${tutorialId}/notes/${n.id}/${n.pinned_at ? 'unpin' : 'pin'}`, n.pinned_at ? 'Unpinned' : 'Pinned as a revision — shows above Steps')
            }
          />
        ) : null}
        {viewerId === n.author_id ? (
          <Button label="Delete" variant="ghost" onPress={() => void act(`/api/tutorials/${tutorialId}/notes/${n.id}`, 'Note deleted', 'delete')} />
        ) : (
          <ReportProblem subjectKind="guide" subjectId={tutorialId} subjectLabel={`A note on ${guideTitle}`} />
        )}
      </View>
    </View>
  )

  return (
    <Section title={`Community notes ${notes.length}`}>
      <Text style={styles.lead}>
        Built this and found a step missing? Add a note against the step. {authorName} can pin it as a revision so everyone sees it.
      </Text>
      <FlashLine message={flash} />
      {pinned.length ? <Text style={styles.eyebrow}>{`Revisions · ${pinned.length} pinned`}</Text> : null}
      {pinned.map(noteRow)}
      <Text style={styles.eyebrow}>{`Discussion · ${open.length}`}</Text>
      {open.map(noteRow)}

      {viewerId === null ? (
        // POST /api/tutorials/:id/notes sits behind authMiddleware.
        <Text style={styles.meta}>Sign in to add a note.</Text>
      ) : (
        <View style={styles.form}>
          <Text style={styles.formTitle}>Add a note</Text>
          <View accessibilityLabel="Which step is it about?" style={styles.chips}>
            {steps.map((s) => (
              <Chip key={s.id} label={`Step ${s.position}`} active={at === s.position} onPress={() => setAt(s.position)} />
            ))}
            <Chip label="Missing step" active={at === null} onPress={() => setAt(null)} />
          </View>
          {at === null ? (
            <Text style={styles.meta}>{`Not part of any step above. If pinned, it is added to the end as step ${steps.length + 1}.`}</Text>
          ) : null}
          <TextField
            accessibilityLabel="Your note"
            placeholder="What was missing, or what you did differently…"
            multiline
            maxLength={1000}
            value={body}
            onChangeText={setBody}
          />
          {photo ? (
            <TextField accessibilityLabel="Photo caption" placeholder="Caption (optional)" maxLength={60} value={caption} onChangeText={setCaption} />
          ) : (
            <Button label="Add a photo" variant="ghost" onPress={() => void addPhoto()} />
          )}
          <ErrorRow message={error} />
          <Button label="Post" variant="primary" disabled={at === undefined || !body.trim()} loading={busy} onPress={() => void post()} />
        </View>
      )}
    </Section>
  )
}

const styles = StyleSheet.create({
  lead: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, lineHeight: 19, marginBottom: theme.spacing(3) },
  eyebrow: { fontFamily: theme.fonts.black, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: theme.colors.muted, marginVertical: theme.spacing(2) },
  note: { padding: theme.spacing(3), gap: theme.spacing(1), borderRadius: theme.radii.field, borderWidth: theme.border.hairline, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, marginBottom: theme.spacing(2) },
  pinnedNote: { backgroundColor: theme.colors.honeySoft },
  meta: { fontFamily: theme.fonts.semiBold, fontSize: 12, color: theme.colors.muted },
  body: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.text, lineHeight: 20 },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: theme.radii.field, backgroundColor: theme.colors.surfaceSunken },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: theme.spacing(2) },
  pinnedBy: { fontFamily: theme.fonts.black, fontSize: 12, color: theme.colors.ink },
  form: { marginTop: theme.spacing(3), padding: theme.spacing(3), gap: theme.spacing(2), borderRadius: theme.radii.panel, borderWidth: theme.border.hairline, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  formTitle: { fontFamily: theme.fonts.display, fontSize: 15, color: theme.colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
})
