// packages/mobile/components/guides/feedback-sheet.tsx
//
// The one place feedback on a guide is written: opened from the Feedback
// tab's composer bar and from build mode's done screen. After a post the same
// sheet becomes the confirmation, so there is never a second popup.
import { useEffect, useState } from 'react'
import { View, Text, Modal, Pressable, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { GuideNote, TutorialStep } from '@splat-connect/types'
import { apiMessage } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { pickAndUploadPhoto } from '../../lib/upload'
import { stepLabel } from '../../lib/guide-notes'
import { theme } from '../../lib/theme'
import { Chip } from '../ui/Chip'
import { TextField } from '../ui/TextField'
import { Button } from '../ui/Button'
import { ErrorRow } from '../ui/ErrorRow'

export type FeedbackSheetProps = {
  tutorialId: string
  steps: TutorialStep[]
  authorFirstName: string
  /** undefined: nothing chosen yet; null: Missing step; n: Step n. */
  initialStep?: number | null
  open: boolean
  onClose: () => void
  /** The 201 body, as soon as it lands; the host reloads and highlights. */
  onPosted: (note: GuideNote) => void
  /** Build mode only: close build mode onto the guide with this note in view. */
  onSeeOnGuide?: (note: GuideNote) => void
}

export function FeedbackSheet({ tutorialId, steps, authorFirstName, initialStep, open, onClose, onPosted, onSeeOnGuide }: FeedbackSheetProps) {
  const [at, setAt] = useState<number | null | undefined>(initialStep)
  const [body, setBody] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [posted, setPosted] = useState<GuideNote | null>(null)

  // A blank form every time it opens: the last post must not linger.
  useEffect(() => {
    if (!open) return
    setAt(initialStep)
    setBody('')
    setPhoto(null)
    setCaption('')
    setError(null)
    setPosted(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function addPhoto() {
    try {
      const uploaded = await pickAndUploadPhoto('/api/upload/note-photo', tutorialId)
      if (uploaded) setPhoto(uploaded.path ?? null)
    } catch (err) {
      setError(apiMessage(err, (err as Error).message))
    }
  }

  async function post() {
    setBusy(true)
    setError(null)
    let note: GuideNote
    try {
      note = await apiClient.post<GuideNote>(`/api/tutorials/${tutorialId}/notes`, {
        step_position: at ?? null,
        body: body.trim(),
        photo_path: photo,
        photo_caption: caption.trim() || null,
      })
    } catch (err) {
      setError(apiMessage(err, 'Could not post that. Please try again.'))
      return
    } finally {
      setBusy(false)
    }
    // Outside the try: a throwing host callback must not read as a failed post.
    setPosted(note)
    try {
      onPosted(note)
    } catch (err) {
      console.error('[FeedbackSheet] onPosted threw after the note saved:', err)
    }
  }

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={StyleSheet.absoluteFill} />
        <View style={styles.sheet} testID="feedback-sheet">
          <View style={styles.grabber} />
          {posted ? (
            <View style={styles.done}>
              <View style={styles.tick}><Ionicons name="checkmark" size={30} color={theme.colors.onColor} /></View>
              <Text style={styles.title} accessibilityRole="header">Feedback posted</Text>
              <Text style={styles.sub}>{`It's on the guide's Feedback tab now, under ${stepLabel(posted, steps.length)}.`}</Text>
              <Button label="See it on the guide" onPress={() => (onSeeOnGuide ? onSeeOnGuide(posted) : onClose())} />
              <Button label="Stay here" variant="ghost" onPress={onClose} />
            </View>
          ) : (
            <>
              <View style={styles.head}>
                <Text style={styles.title} accessibilityRole="header">How did it go?</Text>
                <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={6}>
                  <Ionicons name="close" size={22} color={theme.colors.muted} />
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
                <Text style={styles.sub}>{`${authorFirstName} can pin it as a fix so the next builder sees it.`}</Text>
                <Text style={styles.eyebrow}>Which step?</Text>
                <View accessibilityLabel="Which step is it about?" style={styles.chips}>
                  {steps.map((s) => (
                    <Chip key={s.id} label={`Step ${s.position}`} active={at === s.position} onPress={() => setAt(s.position)} />
                  ))}
                  <Chip label="Missing step" active={at === null} onPress={() => setAt(null)} />
                </View>
                <TextField accessibilityLabel="Your note" placeholder="What was missing, or what you did differently…" multiline maxLength={1000} value={body} onChangeText={setBody} />
                {photo ? (
                  <TextField accessibilityLabel="Photo caption" placeholder="Caption (optional)" maxLength={60} value={caption} onChangeText={setCaption} />
                ) : null}
                <ErrorRow message={error} />
                <View style={styles.actions}>
                  {photo ? null : <Button label="Add a photo" variant="ghost" onPress={() => void addPhoto()} />}
                  <Button label="Post" variant="primary" disabled={at === undefined || !body.trim()} loading={busy} onPress={() => void post()} style={styles.post} />
                </View>
              </ScrollView>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.scrim },
  sheet: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: theme.spacing(4), paddingBottom: theme.spacing(6), maxHeight: '88%', ...theme.shadow(3) },
  grabber: { width: 40, height: 5, borderRadius: 3, backgroundColor: theme.colors.border, alignSelf: 'center', marginVertical: theme.spacing(2) },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: theme.fonts.display, fontSize: theme.type.title, color: theme.colors.ink },
  sub: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, lineHeight: 20 },
  eyebrow: { fontFamily: theme.fonts.black, fontSize: theme.type.micro, letterSpacing: 1, textTransform: 'uppercase', color: theme.colors.muted },
  form: { gap: theme.spacing(3), paddingTop: theme.spacing(2) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  actions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  post: { flex: 1 },
  done: { alignItems: 'center', gap: theme.spacing(3), paddingTop: theme.spacing(2) },
  tick: { width: 58, height: 58, borderRadius: 29, backgroundColor: theme.colors.success, alignItems: 'center', justifyContent: 'center' },
})
