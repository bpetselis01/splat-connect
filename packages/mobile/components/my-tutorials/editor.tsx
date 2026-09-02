// packages/mobile/components/my-tutorials/editor.tsx
import { useEffect, useState } from 'react'
import { View, Text, ScrollView, Alert, Image, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import type {
  BuyLink,
  Difficulty,
  Part,
  StlFile,
  Tool,
  TutorialKind,
  TutorialMaturity,
  TutorialOrg,
  TutorialWithDetails,
} from '@splat-connect/types'
import { KIND_LABEL, MATURITY_LABEL, SAFETY_CHECKLIST } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { uploadFile } from '../../lib/upload'
import { supabase } from '../../lib/supabase'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { ScreenHeader } from '../ui/ScreenHeader'
import { TextField } from '../ui/TextField'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { StepPills, type StepPillItem, type StepPillStatus } from '../ui/StepPills'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { ErrorRow } from '../auth-screen'

// GET /api/tutorials/:id embeds this join (reviewer/reviewed_for name); it is
// only on that one contributor-facing route, not on the shared
// TutorialWithDetails type — see packages/api/src/routes/tutorials.ts.
type EditorTutorial = TutorialWithDetails & { reviewed_for?: { name: string } | null }

type StepId = 'details' | 'parts' | 'tools' | 'files' | 'stl' | 'review'

interface Gap {
  step: StepId
  label: string
}

/**
 * What a draft needs before it can be submitted, as gaps: the step that
 * closes each one, and the words to show a contributor. Ported verbatim from
 * web's lib/validation.ts getMissingFields (same eight lines, same order),
 * typed against TutorialWithDetails — a change there is the reminder to
 * bring this copy along.
 */
function getMissingFields(tutorial: TutorialWithDetails): Gap[] {
  const missing: Gap[] = []
  if (!tutorial.title.trim()) missing.push({ step: 'details', label: 'A title' })
  if (!(['easy', 'medium', 'hard'] as string[]).includes(tutorial.difficulty))
    missing.push({ step: 'details', label: 'A difficulty' })
  if (!tutorial.tutorial_pdf_url?.trim()) missing.push({ step: 'files', label: 'The guide PDF' })
  if (!tutorial.toy_photo_url?.trim()) missing.push({ step: 'files', label: 'A photo' })
  if (tutorial.parts.length === 0) missing.push({ step: 'parts', label: 'A part' })
  if (tutorial.tools.length === 0) missing.push({ step: 'tools', label: 'A tool' })
  // The one rule that reads the kind: a printed part is what an assistive-tech
  // tutorial IS, so it cannot be submitted without one. A toy adaptation has no
  // STL step at all, so the gap must never appear for it.
  if (tutorial.kind === 'assistive_tech' && tutorial.stl_files.length === 0)
    missing.push({ step: 'stl', label: 'A 3D-print file' })
  if (!tutorial.safety_declared_at) missing.push({ step: 'details', label: 'The safety declaration' })
  return missing
}

const STEP_LABEL: Record<StepId, string> = {
  details: 'Details',
  parts: 'Parts',
  tools: 'Tools',
  files: 'Files',
  stl: 'STL',
  review: 'Review',
}

/** The pills this tutorial's kind shows, in rail order. */
function stepsFor(kind: TutorialKind): StepId[] {
  const base: StepId[] = ['details', 'parts', 'tools', 'files']
  return kind === 'assistive_tech' ? [...base, 'stl', 'review'] : [...base, 'review']
}

function statusFor(missing: Gap[], step: StepId, tutorial: TutorialWithDetails): StepPillStatus {
  // Review has nothing getMissingFields reports on directly — it mirrors web's
  // edit-steps.ts instead: neutral while still a draft, done once it has been
  // handed over for review.
  if (step === 'review') return tutorial.status === 'draft' ? 'neutral' : 'done'
  return missing.some((g) => g.step === step) ? 'attention' : 'done'
}

const KIND_OPTIONS: { label: string; value: TutorialKind }[] = [
  { label: KIND_LABEL.toy_adaptation, value: 'toy_adaptation' },
  { label: KIND_LABEL.assistive_tech, value: 'assistive_tech' },
]

const DIFFICULTY_OPTIONS: { label: string; value: Difficulty }[] = [
  { label: 'Easy', value: 'easy' },
  { label: 'Medium', value: 'medium' },
  { label: 'Hard', value: 'hard' },
]

const MATURITY_OPTIONS = (Object.keys(MATURITY_LABEL) as TutorialMaturity[]).map((m) => ({
  label: MATURITY_LABEL[m],
  value: m,
}))

/** One editable row of the parts/tools replace-set. `quantity` is only ever
 *  read for parts — tools leave it undefined and the stepper never renders. */
interface ItemRow {
  name: string
  quantity?: number
  is_optional: boolean
  buy_links: BuyLink[]
}

/**
 * Backed-by, reduced to the one line the brief asks for: an accepted org's
 * name and status, or the plain fact that nothing has been asked yet. Pending
 * and declined rows read the same as "not requested" here — the full state
 * machine (BackingSummary) is web's job; this is "ask on the web" territory.
 */
function backingText(rows: TutorialOrg[]): string {
  const accepted = rows.find((r) => r.status === 'accepted')
  if (!accepted) return 'Not requested — ask on the web'
  return `${accepted.organizations?.name ?? 'An organisation'} · ${accepted.status}`
}

/**
 * One editable replace-set list. Parts and tools share every row control
 * except the quantity stepper, which only parts carry.
 */
function ItemsStep({
  noun,
  rows,
  onChange,
  withQuantity,
  saving,
  error,
  onSave,
}: {
  noun: 'part' | 'tool'
  rows: ItemRow[]
  onChange: (rows: ItemRow[]) => void
  withQuantity: boolean
  saving: boolean
  error: string | null
  onSave: () => void
}) {
  const nounLabel = noun === 'part' ? 'Part' : 'Tool'
  const hasBlankRow = rows.some((r) => !r.name.trim())

  function updateRow(index: number, patch: Partial<ItemRow>) {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }
  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index))
  }
  function addRow() {
    onChange([...rows, { name: '', quantity: withQuantity ? 1 : undefined, is_optional: false, buy_links: [] }])
  }

  return (
    <View style={styles.itemsForm}>
      {rows.map((row, index) => (
        <View key={index} style={styles.itemRow}>
          <TextField
            placeholder={`${nounLabel} name`}
            accessibilityLabel={`${nounLabel} ${index + 1} name`}
            value={row.name}
            onChangeText={(text) => updateRow(index, { name: text })}
          />
          <View style={styles.itemControlsRow}>
            {withQuantity ? (
              <View style={styles.quantityRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Decrease quantity for part ${index + 1}`}
                  onPress={() => updateRow(index, { quantity: Math.max(1, (row.quantity ?? 1) - 1) })}
                  style={styles.stepperButton}
                  hitSlop={8}
                >
                  <Text style={styles.stepperGlyph}>−</Text>
                </Pressable>
                <Text style={styles.quantityValue}>{row.quantity ?? 1}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Increase quantity for part ${index + 1}`}
                  onPress={() => updateRow(index, { quantity: (row.quantity ?? 1) + 1 })}
                  style={styles.stepperButton}
                  hitSlop={8}
                >
                  <Text style={styles.stepperGlyph}>+</Text>
                </Pressable>
              </View>
            ) : null}
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: row.is_optional }}
              accessibilityLabel={`${nounLabel} ${index + 1} optional`}
              onPress={() => updateRow(index, { is_optional: !row.is_optional })}
              style={styles.optionalToggle}
            >
              <Ionicons
                name={row.is_optional ? 'checkbox' : 'square-outline'}
                size={20}
                color={theme.colors.primary}
              />
              <Text style={styles.optionalLabel}>Optional</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${noun} ${index + 1}`}
              onPress={() => removeRow(index)}
              style={styles.removeButton}
              hitSlop={8}
            >
              <Ionicons name="close" size={18} color={theme.colors.danger} />
            </Pressable>
          </View>
        </View>
      ))}

      <Button label={`+ Add a ${noun}`} variant="ghost" onPress={addRow} />
      <ErrorRow message={error} />
      <Button label={`Save ${noun}s`} onPress={onSave} loading={saving} disabled={hasBlankRow} />
    </View>
  )
}

export function Editor({ id }: { id: string }) {
  const router = useRouter()
  const [tutorial, setTutorial] = useState<EditorTutorial | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [activeStep, setActiveStep] = useState<StepId>('details')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState<TutorialKind>('toy_adaptation')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [maturity, setMaturity] = useState<TutorialMaturity>('complete')
  const [safetyTicked, setSafetyTicked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Parts / Tools — editable replace-set rows, seeded from the fetched
  // tutorial once it loads.
  const [partsRows, setPartsRows] = useState<ItemRow[]>([])
  const [toolsRows, setToolsRows] = useState<ItemRow[]>([])
  const [partsSaving, setPartsSaving] = useState(false)
  const [partsError, setPartsError] = useState<string | null>(null)
  const [toolsSaving, setToolsSaving] = useState(false)
  const [toolsError, setToolsError] = useState<string | null>(null)

  // Files
  const [photoUploading, setPhotoUploading] = useState(false)
  const [pdfUploading, setPdfUploading] = useState(false)
  const [filesError, setFilesError] = useState<string | null>(null)

  // STL
  const [stlUploading, setStlUploading] = useState(false)
  const [stlError, setStlError] = useState<string | null>(null)

  // Review — backing is a second fetch (GET /api/tutorials/:id doesn't embed
  // tutorial_orgs, unlike the leader-dashboard list route), so it starts null
  // and is filled in lazily once the step is actually opened.
  const [backing, setBacking] = useState<TutorialOrg[] | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    apiClient
      .get<EditorTutorial>(`/api/tutorials/${id}`)
      .then((data) => {
        if (ignore) return
        setTutorial(data)
        setTitle(data.title)
        setDescription(data.description ?? '')
        setKind(data.kind)
        setDifficulty(data.difficulty)
        setMaturity(data.maturity)
        setPartsRows(
          data.parts.map((p) => ({ name: p.name, quantity: p.quantity, is_optional: p.is_optional, buy_links: p.buy_links }))
        )
        setToolsRows(data.tools.map((t) => ({ name: t.name, is_optional: t.is_optional, buy_links: t.buy_links })))
      })
      .catch((err) => {
        console.error('[Editor] tutorial fetch failed:', err)
        if (!ignore) setLoadError(true)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [id])

  useEffect(() => {
    if (activeStep !== 'review' || backing !== null) return
    apiClient
      .get<TutorialOrg[]>(`/api/tutorials/${id}/orgs`)
      .then(setBacking)
      .catch(() => setBacking([]))
  }, [activeStep, backing, id])

  if (loading) {
    return (
      <Screen>
        <SkeletonRow />
        <SkeletonRow />
      </Screen>
    )
  }

  if (loadError || !tutorial) {
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load this guide."
          hint="Check your connection and try again."
        />
      </Screen>
    )
  }

  const missing = getMissingFields(tutorial)
  const steps = stepsFor(tutorial.kind)
  const pills: StepPillItem[] = steps.map((step) => ({
    id: step,
    label: STEP_LABEL[step],
    status: statusFor(missing, step, tutorial),
  }))
  // Captured here, not read off `tutorial` inside the closures below: TS does
  // not carry the `tutorial !== null` narrowing from the guards above across
  // a nested function boundary.
  const loadedUpdatedAt = tutorial.updated_at
  const currentPdfPath = tutorial.tutorial_pdf_url
  const currentStlFiles = tutorial.stl_files
  // RLS (supabase/migrations/001_schema.sql) only allows a contributor's
  // update to land in draft/pending/rejected — a status-preserving PATCH on an
  // approved or rejected row matches zero rows and 409s. Mirrors web's
  // edit/page.tsx saveDetails/patchFileUrls: requeue it to pending instead.
  const requeue = tutorial.status === 'approved' || tutorial.status === 'rejected'

  async function handleSaveDetails() {
    setSaving(true)
    setSaveError(null)
    try {
      // updated_at rides along on every save — the API's optimistic-concurrency
      // token (packages/api/src/routes/tutorials.ts), the same way web's
      // edit-details-section.tsx carries it. Without it the PATCH 400s.
      const updated = await apiClient.patch<EditorTutorial>(`/api/tutorials/${id}`, {
        title,
        description: description.trim() ? description : null,
        kind,
        difficulty,
        maturity,
        // The server stamps safety_declared_at; the client only ever affirms.
        ...(safetyTicked && !tutorial?.safety_declared_at ? { safety_declared: true } : {}),
        updated_at: loadedUpdatedAt,
        ...(requeue && { status: 'pending' as const }),
      })
      setTutorial((prev) => (prev ? { ...prev, ...updated } : updated))
    } catch (err) {
      console.error('[Editor] save details failed:', err)
      setSaveError('Could not save details. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveParts() {
    setPartsSaving(true)
    setPartsError(null)
    try {
      const saved = await apiClient.post<Part[]>(`/api/tutorials/${id}/parts`, {
        parts: partsRows.map(({ name, quantity, is_optional, buy_links }) => ({
          name,
          quantity: quantity ?? 1,
          is_optional,
          buy_links,
        })),
      })
      setTutorial((prev) => (prev ? { ...prev, parts: saved } : prev))
    } catch (err) {
      console.error('[Editor] save parts failed:', err)
      setPartsError('Could not save parts. Please try again.')
    } finally {
      setPartsSaving(false)
    }
  }

  async function handleSaveTools() {
    setToolsSaving(true)
    setToolsError(null)
    try {
      const saved = await apiClient.post<Tool[]>(`/api/tutorials/${id}/tools`, {
        tools: toolsRows.map(({ name, is_optional, buy_links }) => ({ name, is_optional, buy_links })),
      })
      setTutorial((prev) => (prev ? { ...prev, tools: saved } : prev))
    } catch (err) {
      console.error('[Editor] save tools failed:', err)
      setToolsError('Could not save tools. Please try again.')
    } finally {
      setToolsSaving(false)
    }
  }

  async function pickPhoto(source: 'camera' | 'library') {
    setFilesError(null)
    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        setFilesError(
          source === 'camera'
            ? 'Camera access is needed to take a photo.'
            : 'Photo library access is needed to choose a photo.'
        )
        return
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
          : await ImagePicker.launchImageLibraryAsync({ quality: 0.7 })
      if (result.canceled || !result.assets?.[0]) return
      const asset = result.assets[0]
      setPhotoUploading(true)
      const { url } = await uploadFile('/api/upload/photo', id, {
        uri: asset.uri,
        name: asset.fileName ?? 'photo.jpg',
        mimeType: asset.mimeType ?? 'image/jpeg',
      })
      const updated = await apiClient.patch<EditorTutorial>(`/api/tutorials/${id}`, {
        toy_photo_url: url,
        updated_at: loadedUpdatedAt,
        ...(requeue && { status: 'pending' as const }),
      })
      setTutorial((prev) => (prev ? { ...prev, ...updated } : updated))
    } catch (err) {
      console.error('[Editor] photo upload failed:', err)
      setFilesError('Could not upload the photo. Please try again.')
    } finally {
      setPhotoUploading(false)
    }
  }

  async function pickPdf() {
    setFilesError(null)
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' })
      if (result.canceled || !result.assets?.[0]) return
      const asset = result.assets[0]
      setPdfUploading(true)
      const { url } = await uploadFile('/api/upload/pdf', id, {
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? 'application/pdf',
      })
      const updated = await apiClient.patch<EditorTutorial>(`/api/tutorials/${id}`, {
        tutorial_pdf_url: url,
        updated_at: loadedUpdatedAt,
        ...(requeue && { status: 'pending' as const }),
      })
      setTutorial((prev) => (prev ? { ...prev, ...updated } : updated))
    } catch (err) {
      console.error('[Editor] pdf upload failed:', err)
      setFilesError('Could not upload the PDF. Please try again.')
    } finally {
      setPdfUploading(false)
    }
  }

  // 049 made tutorial-pdfs private: tutorial_pdf_url is an object path, not a
  // URL. Signed in-process with the app's own session, same as
  // components/home/detail-screen.tsx's openPreview — there is no /files
  // route on mobile to route through instead.
  async function openPdfPreview() {
    if (!currentPdfPath) return
    const { data, error } = await supabase.storage.from('tutorial-pdfs').createSignedUrl(currentPdfPath, 60)
    router.push({
      pathname: '/guides/[id]/preview',
      params: { id, pdfUrl: error || !data ? '' : data.signedUrl },
    })
  }

  async function pickStl() {
    setStlError(null)
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*' })
      if (result.canceled || !result.assets?.[0]) return
      const asset = result.assets[0]
      if (!asset.name.toLowerCase().endsWith('.stl')) {
        setStlError('Please choose a .stl file.')
        return
      }
      setStlUploading(true)
      const { url, filename } = await uploadFile('/api/upload/stl', id, {
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? 'application/octet-stream',
      })
      // /api/upload/stl only writes the storage object — it does not insert a
      // stl_files row. Web's AddStlForm (components/add-stl-form.tsx) covers
      // that gap by POSTing the replace-set sub-resource with the existing
      // rows plus the new one; this mirrors that exactly rather than any
      // server-side insert, which does not exist for this route.
      const nextStlFiles = [
        ...currentStlFiles.map((f) => ({ filename: f.filename, file_url: f.file_url })),
        { filename: filename ?? asset.name, file_url: url },
      ]
      const inserted = await apiClient.post<StlFile[]>(`/api/tutorials/${id}/stl-files`, {
        stl_files: nextStlFiles,
      })
      setTutorial((prev) => (prev ? { ...prev, stl_files: inserted } : prev))
    } catch (err) {
      console.error('[Editor] stl upload failed:', err)
      setStlError('Could not upload the STL file. Please try again.')
    } finally {
      setStlUploading(false)
    }
  }

  async function handleSubmitForReview() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const updated = await apiClient.patch<EditorTutorial>(`/api/tutorials/${id}`, {
        status: 'pending',
        updated_at: loadedUpdatedAt,
      })
      setTutorial((prev) => (prev ? { ...prev, ...updated } : updated))
    } catch (err) {
      console.error('[Editor] submit for review failed:', err)
      setSubmitError('Could not submit for review. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleDelete() {
    Alert.alert('Delete this guide?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`/api/tutorials/${id}`)
            router.back()
          } catch (err) {
            console.error('[Editor] delete failed:', err)
          }
        },
      },
    ])
  }

  const reviewerName = tutorial.reviewed_for?.name ?? 'SPLAT'

  return (
    <Screen>
      <ScreenHeader title={tutorial.title || 'Edit guide'} />

      <View style={styles.statusRow}>
        <Badge status={tutorial.status} />
      </View>

      {tutorial.status === 'rejected' && tutorial.rejection_note ? (
        <View style={styles.noteBox}>
          <Text style={styles.noteText}>{tutorial.rejection_note}</Text>
        </View>
      ) : null}

      {tutorial.status === 'pending' ? (
        <View style={styles.pendingBanner}>
          <Text style={styles.pendingText}>
            With {reviewerName} for review. You can still make changes.
          </Text>
        </View>
      ) : null}

      <StepPills steps={pills} active={activeStep} onSelect={(s) => setActiveStep(s as StepId)} />

      <ScrollView
        style={styles.body}
        showsVerticalScrollIndicator={false}
        // iOS: scroll the focused field clear of the keyboard — without this,
        // everything below the fold types blind. Android already resizes the
        // window (adjustResize) and ignores the prop.
        automaticallyAdjustKeyboardInsets
      >
        {activeStep === 'details' ? (
          <View style={styles.detailsForm}>
            <TextField label="Title" placeholder="Title" value={title} onChangeText={setTitle} />
            <TextField
              label="Description"
              placeholder="Description"
              value={description}
              onChangeText={setDescription}
              multiline
            />

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

            <Text style={styles.label}>How far along is it?</Text>
            <View style={styles.chipRow}>
              {MATURITY_OPTIONS.map((o) => (
                <Chip
                  key={o.value}
                  label={o.label}
                  active={maturity === o.value}
                  onPress={() => setMaturity(o.value)}
                />
              ))}
            </View>
            <Text style={styles.safetyHint}>
              Only complete guides appear in the public library listing.
            </Text>

            <Text style={styles.label}>Safety declaration</Text>
            {tutorial.safety_declared_at ? (
              <Text style={styles.safetyHint}>
                Declared on {new Date(tutorial.safety_declared_at).toLocaleDateString('en-AU')}.
              </Text>
            ) : (
              <>
                {SAFETY_CHECKLIST.map((item) => (
                  <Text key={item} style={styles.safetyItem}>
                    {'\u2022'} {item}
                  </Text>
                ))}
                {/* Defaults to off on purpose — a declaration is made, never assumed. */}
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: safetyTicked }}
                  onPress={() => setSafetyTicked((t) => !t)}
                  style={styles.safetyTick}
                >
                  <Ionicons
                    name={safetyTicked ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={theme.colors.primaryDeep}
                  />
                  <Text style={styles.safetyTickText}>
                    I have checked this design against every point above. A guide cannot
                    be submitted for review without this.
                  </Text>
                </Pressable>
              </>
            )}

            <ErrorRow message={saveError} />
            <Button label="Save details" onPress={handleSaveDetails} loading={saving} />
          </View>
        ) : activeStep === 'parts' ? (
          <ItemsStep
            noun="part"
            rows={partsRows}
            onChange={setPartsRows}
            withQuantity
            saving={partsSaving}
            error={partsError}
            onSave={handleSaveParts}
          />
        ) : activeStep === 'tools' ? (
          <ItemsStep
            noun="tool"
            rows={toolsRows}
            onChange={setToolsRows}
            withQuantity={false}
            saving={toolsSaving}
            error={toolsError}
            onSave={handleSaveTools}
          />
        ) : activeStep === 'files' ? (
          <View style={styles.filesForm}>
            <View style={styles.photoTile}>
              {tutorial.toy_photo_url ? (
                <Image source={{ uri: tutorial.toy_photo_url }} style={styles.photoImage} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="image-outline" size={32} color={theme.colors.primary} />
                </View>
              )}
              <View style={styles.photoActions}>
                <Button
                  label="Take a photo"
                  variant="secondary"
                  onPress={() => pickPhoto('camera')}
                  loading={photoUploading}
                />
                <Button
                  label="Choose from library"
                  variant="secondary"
                  onPress={() => pickPhoto('library')}
                  loading={photoUploading}
                />
              </View>
            </View>

            <View style={styles.pdfRow}>
              <Text style={styles.pdfLabel}>{currentPdfPath ? currentPdfPath.split('/').pop() : 'No PDF yet'}</Text>
              <Button label="Choose PDF from Files" variant="secondary" onPress={pickPdf} loading={pdfUploading} />
              {currentPdfPath ? <Button label="Preview" variant="ghost" onPress={openPdfPreview} /> : null}
            </View>

            <ErrorRow message={filesError} />
          </View>
        ) : activeStep === 'stl' ? (
          <View style={styles.stlForm}>
            {tutorial.stl_files.length ? (
              tutorial.stl_files.map((f) => (
                <View key={f.id} style={styles.stlRow}>
                  <Ionicons name="cube-outline" size={18} color={theme.colors.primary} />
                  <Text style={styles.stlFilename}>{f.filename}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.stlEmpty}>No 3D-print files yet.</Text>
            )}
            <Button label="Choose STL from Files" variant="secondary" onPress={pickStl} loading={stlUploading} />
            <ErrorRow message={stlError} />
          </View>
        ) : activeStep === 'review' ? (
          <View style={styles.reviewForm}>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Backed by</Text>
              <Text style={styles.reviewValue}>{backing === null ? 'Checking…' : backingText(backing)}</Text>
            </View>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Collaborators</Text>
              <Text style={styles.reviewValue}>
                {tutorial.tutorial_contributors.map((c) => c.profiles.name).join(', ')} · edit on the web
              </Text>
            </View>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Recommendations</Text>
              <Text style={styles.reviewValue}>{tutorial.tutorial_recommendations.length} of 3 · edit on the web</Text>
            </View>

            {tutorial.status === 'pending' ? (
              <Text style={styles.submittedRow}>Submitted · waiting for review</Text>
            ) : tutorial.status === 'approved' ? (
              <View style={styles.approvedRow}>
                <Text style={styles.approvedText}>✓ Approved · in Guides</Text>
              </View>
            ) : (
              <>
                {missing.length > 0 ? (
                  <Text style={styles.gapList}>Still needed: {missing.map((g) => g.label).join(', ')}</Text>
                ) : null}
                <ErrorRow message={submitError} />
                <Button
                  label="Submit for review"
                  onPress={handleSubmitForReview}
                  disabled={missing.length > 0}
                  loading={submitting}
                />
              </>
            )}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Delete guide" variant="danger" onPress={handleDelete} />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  safetyHint: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    lineHeight: 18,
    marginBottom: theme.spacing(2),
  },
  safetyItem: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    lineHeight: 18,
  },
  safetyTick: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing(2),
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  safetyTickText: {
    flex: 1,
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.text,
    lineHeight: 18,
  },
  statusRow: { flexDirection: 'row', marginBottom: theme.spacing(2) },
  noteBox: {
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.apricotSoft,
    padding: theme.spacing(3),
    marginBottom: theme.spacing(3),
  },
  noteText: { fontFamily: theme.fonts.regular, color: theme.colors.apricotDeep, fontSize: theme.type.label, lineHeight: 20 },
  pendingBanner: {
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.honeySoft,
    padding: theme.spacing(3),
    marginBottom: theme.spacing(3),
  },
  pendingText: { fontFamily: theme.fonts.regular, color: theme.colors.honeyDeep, fontSize: theme.type.label, lineHeight: 20 },
  body: { flex: 1, marginTop: theme.spacing(3) },
  detailsForm: { paddingBottom: theme.spacing(6) },
  label: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.label,
    color: theme.colors.text,
    marginBottom: theme.spacing(2),
  },
  chipRow: { flexDirection: 'row', gap: theme.spacing(2), marginBottom: theme.spacing(4) },
  footer: { borderTopWidth: theme.border.thin, borderTopColor: theme.colors.border, paddingTop: theme.spacing(3) },

  // Parts / Tools
  itemsForm: { paddingBottom: theme.spacing(6) },
  itemRow: {
    marginBottom: theme.spacing(4),
    paddingBottom: theme.spacing(3),
    borderBottomWidth: theme.border.thin,
    borderBottomColor: theme.colors.border,
  },
  itemControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing(1),
  },
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: theme.radii.sm,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  stepperGlyph: { fontFamily: theme.fonts.bold, fontSize: theme.type.body, color: theme.colors.ink },
  quantityValue: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.text, minWidth: 20, textAlign: 'center' },
  optionalToggle: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1) },
  optionalLabel: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted },
  removeButton: { padding: theme.spacing(1) },

  // Files
  filesForm: { paddingBottom: theme.spacing(6) },
  photoTile: { marginBottom: theme.spacing(5) },
  photoImage: { width: '100%', height: 180, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surfaceSunken, marginBottom: theme.spacing(3) },
  photoPlaceholder: {
    width: '100%',
    height: 180,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing(3),
  },
  photoActions: { flexDirection: 'row', gap: theme.spacing(2) },
  pdfRow: { gap: theme.spacing(2), marginBottom: theme.spacing(4) },
  pdfLabel: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.label, color: theme.colors.text },

  // STL
  stlForm: { paddingBottom: theme.spacing(6) },
  stlRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2), marginBottom: theme.spacing(2) },
  stlFilename: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.text },
  stlEmpty: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, marginBottom: theme.spacing(3) },

  // Review
  reviewForm: { paddingBottom: theme.spacing(6) },
  reviewRow: { marginBottom: theme.spacing(3) },
  reviewLabel: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.text },
  reviewValue: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, marginTop: theme.spacing(1) },
  gapList: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.apricotDeep,
    marginBottom: theme.spacing(3),
  },
  submittedRow: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.label, color: theme.colors.muted },
  approvedRow: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.mintSoft,
    borderRadius: theme.radii.pill,
    paddingVertical: theme.spacing(2),
    paddingHorizontal: theme.spacing(4),
  },
  approvedText: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.mintDeep },
})
