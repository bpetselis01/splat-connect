// packages/mobile/components/my-tutorials/editor.tsx
import { useEffect, useState } from 'react'
import { View, Text, ScrollView, Alert, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import type { Difficulty, TutorialKind, TutorialWithDetails } from '@splat-connect/types'
import { KIND_LABEL } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
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

const STATUS_COPY: Record<StepPillStatus, string> = {
  done: 'Complete.',
  attention: 'Needs attention.',
  neutral: 'Nothing required yet.',
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
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

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
  const activePill = pills.find((p) => p.id === activeStep) ?? pills[0]
  // Captured here, not read off `tutorial` inside the closure below: TS does
  // not carry the `tutorial !== null` narrowing from the guards above across
  // a nested function boundary.
  const loadedUpdatedAt = tutorial.updated_at

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
        updated_at: loadedUpdatedAt,
      })
      setTutorial((prev) => (prev ? { ...prev, ...updated } : updated))
    } catch (err) {
      console.error('[Editor] save details failed:', err)
      setSaveError('Could not save details. Please try again.')
    } finally {
      setSaving(false)
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
            With {reviewerName} for review. Saving any change pulls it back to draft.
          </Text>
        </View>
      ) : null}

      <StepPills steps={pills} active={activeStep} onSelect={(s) => setActiveStep(s as StepId)} />

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
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

            <ErrorRow message={saveError} />
            <Button label="Save details" onPress={handleSaveDetails} loading={saving} />
          </View>
        ) : (
          // Task 7 fills these in. Each pill's own status already carries what
          // is missing — this is a real landing spot, not a placeholder screen.
          <View style={styles.stepPlaceholder}>
            <Text style={styles.stepHeading}>{activePill.label}</Text>
            <Text style={styles.stepStatus}>{STATUS_COPY[activePill.status]}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Delete guide" variant="danger" onPress={handleDelete} />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
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
  stepPlaceholder: { paddingVertical: theme.spacing(8), alignItems: 'center' },
  stepHeading: { fontFamily: theme.fonts.bold, fontSize: theme.type.heading, color: theme.colors.text },
  stepStatus: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, marginTop: theme.spacing(2) },
  footer: { borderTopWidth: theme.border.thin, borderTopColor: theme.colors.border, paddingTop: theme.spacing(3) },
})
