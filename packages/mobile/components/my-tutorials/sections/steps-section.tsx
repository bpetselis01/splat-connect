// packages/mobile/components/my-tutorials/sections/steps-section.tsx
//
// The board's "Editor · steps": one photo and one instruction per action, in
// order (080). Same shape as ItemsSection — rows are local state seeded once,
// every mutation calls replaceSteps, which debounces a PUT of the whole list —
// so there is no Save button and leaving the screen flushes.
//
// A guide needs steps or a PDF (either): getMissingFields gaps this section
// only when it has neither.
import { logFailure } from '../../../lib/log'
import { useRef, useState } from 'react'
import { useRouter } from 'expo-router'
import { View, Text, Image, ScrollView, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useDraft, type StepRow } from '../../../lib/use-tutorial-draft'
import { uploadFile } from '../../../lib/upload'
import { pickPreviewedPhoto } from '../../../lib/pick-photo'
import { theme } from '../../../lib/theme'
import { supabase } from '../../../lib/supabase'
import { Screen } from '../../ui/Screen'
import { TextField } from '../../ui/TextField'
import { Button } from '../../ui/Button'
import { ErrorRow } from '../../ui/ErrorRow'
import { SectionFooter } from '../section-footer'
import { DraftGate } from './draft-gate'
import { SectionProgress } from './section-progress'

const MAX_STEPS = 60

/** Blank clears; otherwise the API's 1-600 whole minutes. */
function parseMinutes(text: string): number | null {
  const n = parseInt(text.replace(/\D/g, ''), 10)
  return Number.isNaN(n) ? null : Math.min(600, Math.max(1, n))
}

// The editor mounts once the draft has arrived (see DraftGate).
export function StepsSection() {
  return <DraftGate>{() => <StepsEditor />}</DraftGate>
}

function StepsEditor() {
  const { tutorial, replaceSteps, saveError } = useDraft()
  // `k` names a row for as long as the screen is open, so an upload that lands
  // after the rows were edited, moved or removed still finds the row it was for.
  const nextKey = useRef(0)
  const [rows, setRows] = useState<(StepRow & { k: number })[]>(() =>
    (tutorial?.steps ?? []).map((s) => ({ title: s.title, body: s.body, photo_url: s.photo_url, tip: s.tip ?? null, minutes: s.minutes ?? null, k: nextKey.current++ }))
  )
  const rowsRef = useRef(rows)
  const [uploading, setUploading] = useState<number | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const router = useRouter()
  const [wantsSteps, setWantsSteps] = useState(false)

  if (!tutorial) return null
  const id = tutorial.id

  function commit(next: (StepRow & { k: number })[]) {
    rowsRef.current = next
    setRows(next)
    replaceSteps(next.map(({ k: _k, ...row }) => row))
  }
  const update = (i: number, patch: Partial<StepRow>) =>
    commit(rowsRef.current.map((r, n) => (n === i ? { ...r, ...patch } : r)))
  function move(i: number, by: -1 | 1) {
    const next = [...rowsRef.current]
    ;[next[i], next[i + by]] = [next[i + by], next[i]]
    commit(next)
  }

  async function pickPhoto(i: number) {
    if (uploading !== null) return
    setLocalError(null)
    try {
      const result = await pickPreviewedPhoto()
      if (result.canceled || !result.assets?.length) return
      const k = rows[i].k
      setUploading(k)
      const asset = result.assets[0]
      const { url } = await uploadFile('/api/upload/step-photo', id, {
        uri: asset.uri,
        name: asset.fileName ?? 'step.jpg',
        mimeType: asset.mimeType ?? 'image/jpeg',
      })
      const at = rowsRef.current.findIndex((r) => r.k === k)
      if (at >= 0) update(at, { photo_url: url })
    } catch (err) {
      logFailure('[StepsSection] photo upload failed:', err)
      setLocalError('Could not upload the photo. Please try again.')
    } finally {
      setUploading(null)
    }
  }

  // Same signing as home/detail-screen openPreview: the bucket is private.
  async function openPdf(path: string) {
    const { data, error } = await supabase.storage.from('tutorial-pdfs').createSignedUrl(path, 60)
    router.push({ pathname: '/guides/[id]/preview', params: { id, pdfUrl: error || !data ? '' : data.signedUrl } })
  }

  const pdf = tutorial.tutorial_pdf_url?.trim() || null
  if (rows.length === 0 && !wantsSteps) {
    return (
      <Screen>
        <ScrollView showsVerticalScrollIndicator={false}>
          <SectionProgress section="steps" />
          {pdf ? (
            <View style={styles.choiceCard}>
              <Text style={styles.pdfPill}>PDF guide added</Text>
              <Text style={styles.cardTitle}>Your guide is the PDF</Text>
              <Text style={styles.cardBody}>Builders will download and follow it. Steps are optional.</Text>
              <Button label="View PDF" onPress={() => void openPdf(pdf)} />
              <Button label="Add steps as well" variant="secondary" onPress={() => setWantsSteps(true)} />
            </View>
          ) : (
            <>
              <View style={styles.choiceCard}>
                <Text style={styles.cardTitle}>Write the steps here</Text>
                <Text style={styles.cardBody}>Step by step instructions with photos. Builders can tick them off as they go.</Text>
                <Button label="Add the first step" onPress={() => setWantsSteps(true)} />
              </View>
              <View style={styles.choiceCard}>
                <Text style={styles.cardTitle}>Or upload a PDF guide</Text>
                <Text style={styles.cardBody}>Already have one? Upload it and skip writing steps.</Text>
                <Button label="Upload a PDF" variant="secondary" onPress={() => router.push(`/tutorials/${id}/files`)} />
              </View>
            </>
          )}
        </ScrollView>
        <SectionFooter section="steps" />
      </Screen>
    )
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
        <SectionProgress section="steps" />
        {rows.length === 0 ? <Text style={styles.empty}>One photo and one instruction per action.</Text> : null}

        {rows.map((row, i) => (
          <View key={row.k} testID={`step-row-${i}`} style={styles.card}>
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
                onPress={() => commit(rowsRef.current.filter((_, n) => n !== i))}
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
            <TextField
              accessibilityLabel={`Step ${i + 1} tip`}
              placeholder="A tip or caution (optional)"
              maxLength={300}
              value={row.tip ?? ''}
              onChangeText={(text) => update(i, { tip: text })}
            />
            <TextField
              accessibilityLabel={`Step ${i + 1} minutes`}
              placeholder="Minutes this step takes (optional)"
              keyboardType="number-pad"
              maxLength={3}
              value={row.minutes == null ? '' : String(row.minutes)}
              onChangeText={(text) => update(i, { minutes: parseMinutes(text) })}
            />
            <View style={styles.photoRow}>
              {row.photo_url ? (
                <Image source={{ uri: row.photo_url }} style={styles.thumb} accessibilityIgnoresInvertColors />
              ) : null}
              <Button
                testID={`step-photo-${i}`}
                label={uploading === row.k ? 'Uploading…' : row.photo_url ? 'Replace photo' : 'Add a photo'}
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
            onPress={() => commit([...rowsRef.current, { title: null, body: '', photo_url: null, tip: null, minutes: null, k: nextKey.current++ }])}
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
  choiceCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    padding: theme.spacing(4),
    gap: theme.spacing(2),
    marginBottom: theme.spacing(3),
  },
  pdfPill: {
    alignSelf: 'flex-start',
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.caption,
    color: theme.colors.tone.mint.fg,
    backgroundColor: theme.colors.tone.mint.bg,
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(1),
    overflow: 'hidden',
  },
  cardTitle: { fontFamily: theme.fonts.bold, fontSize: theme.type.body, color: theme.colors.ink },
  cardBody: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted },
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
  numText: { fontFamily: theme.fonts.display, fontSize: theme.type.caption, color: theme.colors.primaryDeep },
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
