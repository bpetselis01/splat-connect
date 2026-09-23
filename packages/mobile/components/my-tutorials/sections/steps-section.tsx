// packages/mobile/components/my-tutorials/sections/steps-section.tsx
//
// The board's "Editor · steps": one photo and one instruction per action, in
// order (080). Same shape as ItemsSection — rows are local state seeded once,
// every mutation calls replaceSteps, which debounces a PUT of the whole list —
// so there is no Save button and leaving the screen flushes.
//
// Optional: not in getMissingFields, because guides written before steps
// existed have none and the PDF still carries the guide.
import { useState } from 'react'
import { View, Text, Image, ScrollView, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useDraft, type StepRow } from '../../../lib/use-tutorial-draft'
import { uploadFile } from '../../../lib/upload'
import { theme } from '../../../lib/theme'
import { Screen } from '../../ui/Screen'
import { TextField } from '../../ui/TextField'
import { Button } from '../../ui/Button'
import { ErrorRow } from '../../auth-screen'
import { SectionFooter } from '../section-footer'

const MAX_STEPS = 60

export function StepsSection() {
  const { tutorial, replaceSteps, saveError } = useDraft()
  const [rows, setRows] = useState<StepRow[]>(() =>
    (tutorial?.steps ?? []).map((s) => ({ title: s.title, body: s.body, photo_url: s.photo_url }))
  )
  const [uploading, setUploading] = useState<number | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  if (!tutorial) return null
  const id = tutorial.id

  function commit(next: StepRow[]) {
    setRows(next)
    replaceSteps(next)
  }
  const update = (i: number, patch: Partial<StepRow>) =>
    commit(rows.map((r, n) => (n === i ? { ...r, ...patch } : r)))
  function move(i: number, by: -1 | 1) {
    const next = [...rows]
    ;[next[i], next[i + by]] = [next[i + by], next[i]]
    commit(next)
  }

  async function pickPhoto(i: number) {
    if (uploading !== null) return
    setLocalError(null)
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        setLocalError('Photo library access is needed to choose a photo.')
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] })
      if (result.canceled || !result.assets?.length) return
      setUploading(i)
      const asset = result.assets[0]
      const { url } = await uploadFile('/api/upload/step-photo', id, {
        uri: asset.uri,
        name: asset.fileName ?? 'step.jpg',
        mimeType: asset.mimeType ?? 'image/jpeg',
      })
      update(i, { photo_url: url })
    } catch (err) {
      console.error('[StepsSection] photo upload failed:', err)
      setLocalError('Could not upload the photo. Please try again.')
    } finally {
      setUploading(null)
    }
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} automaticallyAdjustKeyboardInsets>
        {rows.length === 0 ? (
          <Text style={styles.empty}>
            One photo and one instruction per action. Optional — the PDF still carries the guide.
          </Text>
        ) : null}

        {rows.map((row, i) => (
          <View key={i} testID={`step-row-${i}`} style={styles.card}>
            <View style={styles.head}>
              <View style={styles.num}>
                <Text style={styles.numText}>{i + 1}</Text>
              </View>
              <Pressable
                testID={`step-up-${i}`}
                accessibilityRole="button"
                accessibilityLabel={`Move step ${i + 1} up`}
                accessibilityState={{ disabled: i === 0 }}
                disabled={i === 0}
                onPress={() => move(i, -1)}
                hitSlop={8}
              >
                <Ionicons name="arrow-up" size={20} color={i === 0 ? theme.colors.border : theme.colors.primary} />
              </Pressable>
              <Pressable
                testID={`step-down-${i}`}
                accessibilityRole="button"
                accessibilityLabel={`Move step ${i + 1} down`}
                accessibilityState={{ disabled: i === rows.length - 1 }}
                disabled={i === rows.length - 1}
                onPress={() => move(i, 1)}
                hitSlop={8}
              >
                <Ionicons
                  name="arrow-down"
                  size={20}
                  color={i === rows.length - 1 ? theme.colors.border : theme.colors.primary}
                />
              </Pressable>
              <Pressable
                testID={`step-remove-${i}`}
                accessibilityRole="button"
                accessibilityLabel={`Remove step ${i + 1}`}
                onPress={() => commit(rows.filter((_, n) => n !== i))}
                style={styles.remove}
                hitSlop={8}
              >
                <Ionicons name="close" size={18} color={theme.colors.danger} />
              </Pressable>
            </View>
            <TextField
              accessibilityLabel={`Step ${i + 1} title`}
              placeholder="Short title (optional)"
              maxLength={120}
              value={row.title ?? ''}
              onChangeText={(text) => update(i, { title: text })}
            />
            <TextField
              accessibilityLabel={`Step ${i + 1} instructions`}
              placeholder="What to do in this step"
              multiline
              maxLength={2000}
              value={row.body}
              onChangeText={(text) => update(i, { body: text })}
            />
            <View style={styles.photoRow}>
              {row.photo_url ? (
                <Image source={{ uri: row.photo_url }} style={styles.thumb} accessibilityIgnoresInvertColors />
              ) : null}
              <Button
                testID={`step-photo-${i}`}
                label={uploading === i ? 'Uploading…' : row.photo_url ? 'Replace photo' : 'Add a photo'}
                variant="ghost"
                onPress={() => void pickPhoto(i)}
              />
              {row.photo_url ? (
                <Button label="Remove photo" variant="ghost" onPress={() => update(i, { photo_url: null })} />
              ) : null}
            </View>
            {/* Named rather than silently dropped: replaceSteps leaves
                blank-bodied rows out of the PUT, so without this it looks saved. */}
            {!row.body.trim() ? <Text style={styles.blankHint}>Add the instructions to save this step</Text> : null}
          </View>
        ))}

        {rows.length < MAX_STEPS ? (
          <Button
            testID="steps-add"
            label="+ Add a step"
            variant="ghost"
            style={styles.add}
            onPress={() => commit([...rows, { title: null, body: '', photo_url: null }])}
          />
        ) : null}
        <ErrorRow message={localError ?? saveError} />
      </ScrollView>
      <SectionFooter section="steps" />
    </Screen>
  )
}

const styles = StyleSheet.create({
  empty: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    marginBottom: theme.spacing(3),
  },
  // The board's section card: panel radius, one elevation, 14px in.
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.panel,
    padding: 14,
    marginBottom: theme.spacing(3),
    ...theme.shadow(1),
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), marginBottom: theme.spacing(2) },
  num: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentLight,
  },
  numText: { fontFamily: theme.fonts.display, fontSize: 13, color: theme.colors.primaryDeep },
  // The board's dashed full-width "+ Add" under a section's cards.
  add: {
    borderStyle: 'dashed',
    borderWidth: theme.border.hairline * 1.5,
    borderColor: theme.colors.muted,
    borderRadius: theme.radii.pill,
    minHeight: 50,
  },

  remove: { marginLeft: 'auto' },
  photoRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: theme.spacing(2) },
  thumb: { width: 72, height: 54, borderRadius: theme.radii.field },
  blankHint: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.ink,
    marginTop: theme.spacing(2),
  },
})
