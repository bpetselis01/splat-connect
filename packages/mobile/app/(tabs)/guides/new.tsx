// packages/mobile/app/(tabs)/guides/new.tsx
import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { randomUUID } from 'expo-crypto'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import type { Difficulty, PdfImportDraft, TutorialKind } from '@splat-connect/types'
import { apiMessage, KIND_LABEL, SWITCH_TARGET_LABEL, createGuideFromPdfDraft, pdfDraftChecklist, PDF_IMPORT_MAX_BYTES, PDF_IMPORT_MAX_LABEL } from '@splat-connect/types'
import { apiClient } from '../../../lib/api-client'
import { uploadFile } from '../../../lib/upload'
import { parseYears } from '../../../lib/tutorial-sections'
import { useAuth } from '../../../lib/auth-context'
import { theme } from '../../../lib/theme'
import { Screen } from '../../../components/ui/Screen'
import { TextField } from '../../../components/ui/TextField'
import { Chip } from '../../../components/ui/Chip'
import { Button } from '../../../components/ui/Button'
import { ErrorRow } from '../../../components/ui/ErrorRow'
import { TermsCheckbox } from '../../../components/auth/parts'

const KIND_OPTIONS: { label: string; value: TutorialKind }[] = [
  { label: KIND_LABEL.toy_adaptation, value: 'toy_adaptation' },
  { label: KIND_LABEL.assistive_tech, value: 'assistive_tech' },
]

const DIFFICULTY_OPTIONS: { label: string; value: Difficulty }[] = [
  { label: 'Easy', value: 'easy' },
  { label: 'Medium', value: 'medium' },
  { label: 'Hard', value: 'hard' },
]

type PdfAsset = { uri: string; name: string; mimeType?: string }

export default function NewGuideRoute() {
  const router = useRouter()
  const { acceptContributorTerms } = useAuth()
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<TutorialKind>('toy_adaptation')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [cover, setCover] = useState<{ uri: string; name: string; mimeType: string } | null>(null)
  const [switchTarget, setSwitchTarget] = useState<'large' | 'small' | null>(null)
  const [ageMin, setAgeMin] = useState('')
  const [ageMax, setAgeMax] = useState('')
  const [needsTerms, setNeedsTerms] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // Minted once on first submit and reused on the terms-gate retry — a second
  // randomUUID() there would leave the first draft orphaned since the API
  // only replays a create for the SAME id as a 200.
  const [draftId, setDraftId] = useState<string | null>(null)
  // "Start from a PDF": the API reads the PDF (text heuristics, no AI) into a
  // draft the author reviews here before anything is saved.
  const [start, setStart] = useState<'blank' | 'pdf'>('blank')
  const [pdf, setPdf] = useState<PdfAsset | null>(null)
  const [pdfDraft, setPdfDraft] = useState<PdfImportDraft | null>(null)
  const [reading, setReading] = useState(false)

  async function choosePdf() {
    setError(null)
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' })
    if (result.canceled || !result.assets?.[0]) return
    const asset = result.assets[0]
    if (asset.size != null && asset.size > PDF_IMPORT_MAX_BYTES) {
      setError(`That PDF is over ${PDF_IMPORT_MAX_LABEL}.`)
      return
    }
    const file = { uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/pdf' }
    setReading(true)
    try {
      const draft = await uploadFile<PdfImportDraft>('/api/tutorials/import-pdf', '', file, null)
      setPdf(file)
      setPdfDraft(draft)
      setTitle(draft.title ?? '')
      setKind(draft.kind)
      setDifficulty(draft.difficulty ?? 'easy')
    } catch (err) {
      setError(apiMessage(err, 'Could not read this PDF. Please try again.'))
    } finally {
      setReading(false)
    }
  }

  async function chooseCover() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) return setError('Photo library access is needed to choose a photo.')
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] })
    const asset = result.canceled ? null : result.assets?.[0]
    if (asset) setCover({ uri: asset.uri, name: asset.fileName ?? 'photo.jpg', mimeType: asset.mimeType ?? 'image/jpeg' })
  }

  // After the draft exists and its author is linked: the photo route checks
  // tutorial_contributors. Best effort — the editor has every one of these.
  async function applyExtras(id: string) {
    const fields: Record<string, unknown> = {}
    if (switchTarget) fields.switch_target = switchTarget
    const min = parseYears(ageMin)
    const max = parseYears(ageMax)
    if (min !== null) fields.age_min = min
    if (max !== null) fields.age_max = max
    if (!cover && !Object.keys(fields).length) return
    try {
      const { updated_at } = await apiClient.get<{ updated_at: string }>(`/api/tutorials/${id}`)
      const photo = cover ? (await uploadFile('/api/upload/photo', id, cover)).url : null
      await apiClient.patch(`/api/tutorials/${id}`, { updated_at, ...(photo ? { photo_urls: [photo] } : {}), ...fields })
    } catch (err) {
      console.error('[NewGuideRoute] extras not saved:', err)
    }
  }

  async function createDraft(id: string) {
    if (start === 'pdf' && pdfDraft && pdf) {
      // Creates the guide, stores the PDF as its PDF, and fills parts, tools
      // and steps; throws (403 included) only if the create itself fails.
      const result = await createGuideFromPdfDraft(
        apiClient,
        id,
        { ...pdfDraft, title, kind, difficulty },
        async (tutorialId) => (await uploadFile('/api/upload/pdf', tutorialId, pdf)).url
      )
      await applyExtras(id)
      router.replace({
        pathname: '/tutorials/[id]',
        params: {
          id,
          fromPdf: '1',
          ...(result.stepsUnavailable ? { stepsLater: '1' } : {}),
          ...(result.failed.length ? { missed: result.failed.join(',') } : {}),
        },
      })
      return
    }
    await apiClient.post('/api/tutorials', { id, title, difficulty, kind })
    // POST /api/tutorials writes the tutorials row and nothing else — the
    // author is linked by this second call, exactly as web's
    // new-tutorial-form.tsx does it. Without it the draft has no
    // tutorial_contributors row, every RLS policy on a draft reads through
    // that table, and the editor this line redirects into 404s on its own
    // GET. Retry-safe on the API side (23505 -> 200), same as the create.
    await apiClient.post(`/api/contributors/me/tutorials/${id}`, {})
    await applyExtras(id)
    router.replace({ pathname: '/tutorials/[id]', params: { id, justCreated: '1' } })
  }

  async function handleCreate() {
    setError(null)
    setSubmitting(true)
    const id = draftId ?? randomUUID()
    setDraftId(id)
    try {
      await createDraft(id)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (/403/.test(message)) {
        setNeedsTerms(true)
      } else {
        setError('Could not create this guide. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAcceptAndContinue() {
    setError(null)
    setSubmitting(true)
    const res = await acceptContributorTerms()
    if (res.error) {
      setError(res.error)
      setSubmitting(false)
      return
    }
    setNeedsTerms(false)
    try {
      await createDraft(draftId as string)
    } catch {
      setError('Could not create this guide. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Screen>
      {/* The sheet's own header says Add a guide; this is its lead. */}
      <Text style={styles.intro}>Two things to start: what the toy is, and one photo. The rest can wait for the editor.</Text>

      <View accessibilityRole="radiogroup" style={styles.chipRow}>
        <Chip role="radio" label="Start blank" active={start === 'blank'} onPress={() => setStart('blank')} />
        <Chip role="radio" label="Start from a PDF" active={start === 'pdf'} onPress={() => setStart('pdf')} />
      </View>

      {start === 'pdf' && !pdfDraft ? (
        <View>
          <Text style={styles.termsCopy}>
            We read your guide&apos;s PDF and fill in what we can — title, parts, tools, steps and
            print settings. It is a best guess from the text, and photos inside the PDF are not
            copied. Up to {PDF_IMPORT_MAX_LABEL}.
          </Text>
          <ErrorRow message={error} />
          <Button label="Choose PDF" variant="accent" onPress={choosePdf} loading={reading} />
        </View>
      ) : (
        <>
          {start === 'pdf' && pdfDraft ? (
            <View testID="new-guide-pdf-found" style={styles.found}>
              <Text style={styles.label}>What we found in {pdf?.name}</Text>
              {pdfDraftChecklist(pdfDraft).map((row) => (
                <Text key={row.label} style={styles.termsCopy}>
                  {row.found ? '✓' : '–'} {row.label}: {row.found ?? 'not found'}
                </Text>
              ))}
              {pdfDraft.warnings.map((w) => (
                <Text key={w} style={styles.warning}>
                  {w}
                </Text>
              ))}
            </View>
          ) : null}

        <TextField label="Title" placeholder="Title" value={title} onChangeText={setTitle} />

        <Text style={styles.label}>Cover photo</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Add a cover photo" onPress={() => void chooseCover()} style={styles.cover}>
          <Text style={styles.termsCopy}>{cover ? 'Cover photo chosen' : 'Tap to add — the finished toy, plain background'}</Text>
        </Pressable>

        <Text style={styles.label}>Kind</Text>
        <View style={styles.chipRow}>
          {KIND_OPTIONS.map((o) => (
            <Chip key={o.value} label={o.label} active={kind === o.value} onPress={() => setKind(o.value)} />
          ))}
        </View>

        <Text style={styles.label}>Difficulty</Text>
        <View style={styles.chipRow}>
          {DIFFICULTY_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              label={o.label}
              active={difficulty === o.value}
              onPress={() => setDifficulty(o.value)}
            />
          ))}
        </View>

        <Text style={styles.label}>Switch type</Text>
        <View style={styles.chipRow}>
          {(Object.keys(SWITCH_TARGET_LABEL) as ('large' | 'small')[]).map((v) => (
            <Chip
              key={v}
              label={SWITCH_TARGET_LABEL[v].charAt(0).toUpperCase() + SWITCH_TARGET_LABEL[v].slice(1)}
              active={switchTarget === v}
              onPress={() => setSwitchTarget((cur) => (cur === v ? null : v))}
            />
          ))}
        </View>

        <Text style={styles.label}>Age range</Text>
        <View style={styles.chipRow}>
          <TextField accessibilityLabel="Youngest age" placeholder="From" keyboardType="number-pad" value={ageMin} onChangeText={setAgeMin} boxStyle={styles.ageBox} />
          <TextField accessibilityLabel="Oldest age" placeholder="To" keyboardType="number-pad" value={ageMax} onChangeText={setAgeMax} boxStyle={styles.ageBox} />
        </View>

        {needsTerms ? (
          <View style={styles.termsGate}>
            <Text style={styles.termsCopy}>
              You must accept the contributor terms before contributing.
            </Text>
            <TermsCheckbox
              testID="new-guide-accept-terms"
              checked={accepted}
              onPress={() => setAccepted((v) => !v)}
            />
            <ErrorRow message={error} />
            <Button
              label="Accept and continue"
              onPress={handleAcceptAndContinue}
              disabled={!accepted}
              loading={submitting}
            />
          </View>
        ) : (
          <>
            <ErrorRow message={error} />
            <Button
              label="Create draft"
              variant="accent"
              onPress={handleCreate}
              disabled={!title.trim()}
              loading={submitting}
            />
          </>
        )}
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  intro: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.body,
    color: theme.colors.muted,
    lineHeight: 22,
    marginBottom: theme.spacing(4),
  },
  label: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.label,
    color: theme.colors.text,
    marginBottom: theme.spacing(2),
  },
  chipRow: { flexDirection: 'row', gap: theme.spacing(2), marginBottom: theme.spacing(4) },
  cover: {
    padding: theme.spacing(4),
    borderRadius: theme.radii.field,
    borderWidth: theme.border.hairline,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    marginBottom: theme.spacing(4),
  },
  ageBox: { flex: 1 },
  termsGate: { marginTop: theme.spacing(2) },
  found: { marginBottom: theme.spacing(4) },
  warning: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.text,
    lineHeight: 20,
    marginBottom: theme.spacing(2),
    opacity: 0.8,
  },
  termsCopy: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.text,
    lineHeight: 20,
    marginBottom: theme.spacing(3),
  },
})
