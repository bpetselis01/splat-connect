// packages/mobile/components/my-toys/editor.tsx
import { useEffect, useState } from 'react'
import { View, Text, ScrollView, Alert, Image, Pressable, Switch, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import type { OfferType, Toy, ToyTransactionSummary } from '@splat-connect/types'
import { isOwnerSide } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { uploadFile } from '../../lib/upload'
import { theme } from '../../lib/theme'
import { useCapabilities } from '../../lib/capabilities'
import { Screen } from '../ui/Screen'
import { ScreenHeader } from '../ui/ScreenHeader'
import { TextField } from '../ui/TextField'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'
import { StepPills, type StepPillItem, type StepPillStatus } from '../ui/StepPills'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { ErrorRow } from '../auth-screen'

type ToyStepId = 'details' | 'photos' | 'review'

interface Gap {
  step: ToyStepId
  label: string
}

/**
 * Ported verbatim from web's lib/toy-steps.ts getMissingToyFields — same
 * porting rule as the tutorial editor's getMissingFields (P2's bring-along
 * comment). A change there is the reminder to bring this copy along. The only
 * change here is the return type name (Gap, not Gap<ToyStepId>) — this file
 * has no generic Gap/Step/StepStatus module to import from, so it keeps its
 * own local shape, the same way the tutorial editor does.
 */
function getMissingToyFields(toy: {
  cover_photo_url: string | null
  switch_adapted: boolean
  switch_photo_urls: string[]
  offer_type: OfferType | null
}): Gap[] {
  const missing: Gap[] = []
  if (!toy.cover_photo_url) missing.push({ step: 'photos', label: 'A cover photo' })
  if (toy.switch_adapted && toy.switch_photo_urls.length === 0)
    missing.push({ step: 'photos', label: 'A switch photo' })
  if (!toy.offer_type) missing.push({ step: 'review', label: 'How it is offered' })
  return missing
}

/** Ported verbatim from web's lib/toy-steps.ts computeToyStepStatuses. */
function computeToyStepStatuses(toy: Toy): Record<ToyStepId, StepPillStatus> {
  const photosMissing =
    !toy.cover_photo_url || (toy.switch_adapted && toy.switch_photo_urls.length === 0)
  return {
    details: 'done',
    photos: photosMissing ? 'attention' : 'done',
    review: toy.status === 'published' ? 'done' : 'neutral',
  }
}

const STEP_LABEL: Record<ToyStepId, string> = { details: 'Details', photos: 'Photos', review: 'Review' }
const CONDITIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const OFFER_OPTIONS: { label: string; value: OfferType }[] = [
  { label: 'Donation', value: 'donation' },
  { label: 'Exchange', value: 'exchange' },
  { label: 'Both', value: 'both' },
]
const OFFER_LABEL: Record<OfferType, string> = { donation: 'Donation', exchange: 'Exchange', both: 'Donation or exchange' }

export function Editor({ id }: { id: string }) {
  const router = useRouter()
  const { caps } = useCapabilities()
  const [toy, setToy] = useState<Toy | null>(null)
  const [transactions, setTransactions] = useState<ToyTransactionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [activeStep, setActiveStep] = useState<ToyStepId>('details')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [condition, setCondition] = useState(5)
  const [switchAdapted, setSwitchAdapted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [coverUploading, setCoverUploading] = useState(false)
  const [switchUploading, setSwitchUploading] = useState(false)
  const [photosError, setPhotosError] = useState<string | null>(null)

  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)

  // toys.ts is deliberately GET-collection-only ("nothing in the UI needs a
  // single-row fetch outside the collection"), so this reads the whole list
  // and picks the one row, same as web's dashboard/toys/[id]/page.tsx. The
  // transactions list rides along on the same load — Review's offers row and
  // the archived record both need it, and there is no toy-scoped filter on
  // the API to fetch it lazily per step.
  useEffect(() => {
    let ignore = false
    setLoading(true)
    setLoadError(false)
    Promise.all([
      apiClient.get<Toy[]>('/api/toys'),
      apiClient.get<ToyTransactionSummary[]>('/api/toy-transactions'),
    ])
      .then(([toys, tx]) => {
        if (ignore) return
        const found = toys.find((t) => t.id === id) ?? null
        if (!found) {
          setLoadError(true)
          return
        }
        setToy(found)
        setName(found.name)
        setDescription(found.description ?? '')
        setCondition(found.condition)
        setSwitchAdapted(found.switch_adapted)
        setTransactions(tx)
      })
      .catch((err) => {
        console.error('[Editor] toy fetch failed:', err)
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

  if (loadError || !toy) {
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load this toy."
          hint="Check your connection and try again."
        />
      </Screen>
    )
  }

  // Captured here, not read off `toy` inside the closures below: TS does not
  // carry the `toy !== null` narrowing from the guards above across a nested
  // function boundary — same reason the tutorial editor captures
  // loadedUpdatedAt/currentPdfPath ahead of its own closures.
  const currentSwitchPhotoUrls = toy.switch_photo_urls

  const missing = getMissingToyFields(toy)
  const statuses = computeToyStepStatuses(toy)
  const pills: StepPillItem[] = (['details', 'photos', 'review'] as ToyStepId[]).map((step) => ({
    id: step,
    label: STEP_LABEL[step],
    status: statuses[step],
  }))

  // Owner-side requests still open on this toy — the same isOwnerSide check
  // list-screen.tsx's waitingCounts uses, so a leader's org toy counts too.
  const offersWaiting = caps
    ? transactions.filter(
        (t) =>
          t.toy_id === toy.id &&
          t.status === 'requested' &&
          isOwnerSide(t, caps.profile.id, caps.ledOrgs.map((o) => o.id))
      ).length
    : 0

  async function handleSaveDetails() {
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await apiClient.patch<Toy>(`/api/toys/${id}`, {
        name,
        description: description.trim() ? description : null,
        condition,
        switch_adapted: switchAdapted,
      })
      setToy((prev) => (prev ? { ...prev, ...updated } : updated))
    } catch (err) {
      console.error('[Editor] save details failed:', err)
      setSaveError('Could not save details. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // Shared by the cover and switch pickers below — same permission/pick flow,
  // only what happens with the picked asset differs between them.
  async function pickImageAsset(source: 'camera' | 'library') {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      setPhotosError(
        source === 'camera'
          ? 'Camera access is needed to take a photo.'
          : 'Photo library access is needed to choose a photo.'
      )
      return null
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.7 })
    if (result.canceled || !result.assets?.[0]) return null
    return result.assets[0]
  }

  async function pickCover(source: 'camera' | 'library') {
    // Set before the picker (an async, user-paced step) rather than after it
    // resolves, and bail if a prior press is still in flight — otherwise the
    // camera and library buttons (or a fast double-press) can both reach the
    // upload below before either one's `loading` prop has re-rendered true.
    if (coverUploading) return
    setPhotosError(null)
    setCoverUploading(true)
    try {
      const asset = await pickImageAsset(source)
      if (!asset) return
      const { url } = await uploadFile(
        '/api/upload/toy-cover',
        id,
        { uri: asset.uri, name: asset.fileName ?? 'cover.jpg', mimeType: asset.mimeType ?? 'image/jpeg' },
        'toyId'
      )
      const updated = await apiClient.patch<Toy>(`/api/toys/${id}`, { cover_photo_url: url })
      setToy((prev) => (prev ? { ...prev, ...updated } : updated))
    } catch (err) {
      console.error('[Editor] cover upload failed:', err)
      setPhotosError('Could not upload the photo. Please try again.')
    } finally {
      setCoverUploading(false)
    }
  }

  async function pickSwitchPhoto(source: 'camera' | 'library') {
    // Same reentrancy guard as pickCover above — set ahead of the async
    // picker, not after it resolves, and bail while a press is in flight.
    if (switchUploading) return
    setPhotosError(null)
    setSwitchUploading(true)
    try {
      const asset = await pickImageAsset(source)
      if (!asset) return
      const { url } = await uploadFile(
        '/api/upload/toy-switch-photo',
        id,
        { uri: asset.uri, name: asset.fileName ?? 'switch.jpg', mimeType: asset.mimeType ?? 'image/jpeg' },
        'toyId'
      )
      // The gallery is a replace-set append, not a form field, so the
      // current server list (not local component state) is what gets
      // extended.
      const updated = await apiClient.patch<Toy>(`/api/toys/${id}`, {
        switch_photo_urls: [...currentSwitchPhotoUrls, url],
      })
      setToy((prev) => (prev ? { ...prev, ...updated } : updated))
    } catch (err) {
      console.error('[Editor] switch photo upload failed:', err)
      setPhotosError('Could not upload the photo. Please try again.')
    } finally {
      setSwitchUploading(false)
    }
  }

  async function handleSelectOffer(offerType: OfferType) {
    setPublishError(null)
    try {
      const updated = await apiClient.patch<Toy>(`/api/toys/${id}`, { offer_type: offerType })
      setToy((prev) => (prev ? { ...prev, ...updated } : updated))
    } catch (err) {
      console.error('[Editor] save offer type failed:', err)
      // Shares publishError/its ErrorRow below rather than a state of its
      // own — both are Review-step failures on the same toy, and a chip that
      // silently declined to switch otherwise reads as "nothing happened".
      setPublishError('Could not save that. Please try again.')
    }
  }

  async function handlePublish() {
    setPublishing(true)
    setPublishError(null)
    try {
      const updated = await apiClient.patch<Toy>(`/api/toys/${id}/publish`, {})
      setToy((prev) => (prev ? { ...prev, ...updated } : updated))
    } catch (err) {
      console.error('[Editor] publish failed:', err)
      setPublishError('Could not publish this toy. Please try again.')
    } finally {
      setPublishing(false)
    }
  }

  function handleDelete() {
    Alert.alert('Delete this toy?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`/api/toys/${id}`)
            router.back()
          } catch (err) {
            console.error('[Editor] delete failed:', err)
            Alert.alert('Could not delete this toy', 'Please try again.')
          }
        },
      },
    ])
  }

  return (
    <Screen>
      <ScreenHeader title={toy.name || 'Edit toy'} />

      <StepPills steps={pills} active={activeStep} onSelect={(s) => setActiveStep(s as ToyStepId)} />

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {activeStep === 'details' ? (
          <View style={styles.detailsForm}>
            <TextField label="Name" placeholder="Name" value={name} onChangeText={setName} />
            <TextField
              label="Description"
              placeholder="Description"
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <Text style={styles.label}>Condition</Text>
            <View accessibilityRole="radiogroup" style={styles.chipRow}>
              {CONDITIONS.map((c) => (
                <Chip
                  key={c}
                  role="radio"
                  label={String(c)}
                  active={condition === c}
                  onPress={() => setCondition(c)}
                />
              ))}
            </View>
            <View style={styles.conditionEnds}>
              <Text style={styles.conditionCaption}>needs repair</Text>
              <Text style={styles.conditionCaption}>like new</Text>
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.label}>Switch-adapted</Text>
              <Switch
                testID="switch-adapted-switch"
                accessibilityLabel="Switch-adapted"
                value={switchAdapted}
                onValueChange={setSwitchAdapted}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor="#ffffff"
              />
            </View>

            <ErrorRow message={saveError} />
            <Button label="Save details" onPress={handleSaveDetails} loading={saving} />
          </View>
        ) : activeStep === 'photos' ? (
          <View style={styles.photosForm}>
            <Text style={styles.label}>Cover photo</Text>
            <View style={styles.photoTile}>
              {toy.cover_photo_url ? (
                <Image source={{ uri: toy.cover_photo_url }} style={styles.photoImage} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="image-outline" size={32} color={theme.colors.primary} />
                </View>
              )}
              <View style={styles.photoActions}>
                <Button
                  label="Take a cover photo"
                  variant="secondary"
                  onPress={() => pickCover('camera')}
                  loading={coverUploading}
                />
                <Button
                  label="Choose cover photo from library"
                  variant="secondary"
                  onPress={() => pickCover('library')}
                  loading={coverUploading}
                />
              </View>
            </View>

            {/* Gated on the persisted toy.switch_adapted, not the local
                unsaved `switchAdapted` draft above — every gap check
                (getMissingToyFields, computeToyStepStatuses, the server's
                own publish check) reads the saved column, so a flipped-but-
                unsaved toggle must not open an upload path none of them see. */}
            {toy.switch_adapted ? (
              <View style={styles.switchPhotosSection}>
                <Text style={styles.label}>Switch photos</Text>
                {toy.switch_photo_urls.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.switchStripContent}>
                    {toy.switch_photo_urls.map((url) => (
                      <Image key={url} source={{ uri: url }} style={styles.switchImage} />
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={styles.switchEmpty}>No switch photos yet.</Text>
                )}
                <View style={styles.photoActions}>
                  <Button
                    label="Take a switch photo"
                    variant="secondary"
                    onPress={() => pickSwitchPhoto('camera')}
                    loading={switchUploading}
                  />
                  <Button
                    label="Choose switch photo from library"
                    variant="secondary"
                    onPress={() => pickSwitchPhoto('library')}
                    loading={switchUploading}
                  />
                </View>
              </View>
            ) : null}

            <ErrorRow message={photosError} />
          </View>
        ) : (
          <View style={styles.reviewForm}>
            <Text style={styles.label}>Offer this toy for</Text>
            <View style={styles.chipRow}>
              {OFFER_OPTIONS.map((o) => (
                <Chip
                  key={o.value}
                  label={o.label}
                  active={toy.offer_type === o.value}
                  onPress={() => handleSelectOffer(o.value)}
                />
              ))}
            </View>

            {offersWaiting > 0 ? (
              <Pressable
                onPress={() => router.push(`/exchanges?toy=${id}`)}
                accessibilityRole="button"
                accessibilityLabel={`${offersWaiting} offer${offersWaiting === 1 ? '' : 's'} on this toy · Waiting on you`}
                style={styles.offersRow}
              >
                <Text style={styles.offersText}>
                  {offersWaiting} offer{offersWaiting === 1 ? '' : 's'} on this toy · Waiting on you
                </Text>
              </Pressable>
            ) : null}

            {/* Not nested under the published/unpublished branch below: a
                failed offer_type PATCH (handleSelectOffer) can happen either
                way, and this is the one ErrorRow the Review step has. */}
            <ErrorRow message={publishError} />

            {toy.status === 'published' ? (
              <View style={styles.publishedRow}>
                <Text style={styles.publishedText}>✓ Published · in the Toy Library</Text>
              </View>
            ) : (
              <>
                {missing.length > 0 ? (
                  <Text style={styles.gapList}>Still needed: {missing.map((g) => g.label).join(', ')}</Text>
                ) : null}
                <Button
                  label="Publish to the Toy Library"
                  onPress={handlePublish}
                  disabled={missing.length > 0}
                  loading={publishing}
                />
              </>
            )}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Delete toy" variant="danger" onPress={handleDelete} />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  body: { flex: 1, marginTop: theme.spacing(3) },
  label: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.label,
    color: theme.colors.text,
    marginBottom: theme.spacing(2),
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2), marginBottom: theme.spacing(1) },
  conditionEnds: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing(4) },
  conditionCaption: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(4),
  },
  footer: { borderTopWidth: theme.border.thin, borderTopColor: theme.colors.border, paddingTop: theme.spacing(3) },

  detailsForm: { paddingBottom: theme.spacing(6) },

  photosForm: { paddingBottom: theme.spacing(6) },
  photoTile: { marginBottom: theme.spacing(5) },
  photoImage: {
    width: '100%',
    height: 180,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surfaceSunken,
    marginBottom: theme.spacing(3),
  },
  photoPlaceholder: {
    width: '100%',
    height: 180,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing(3),
  },
  photoActions: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  switchPhotosSection: { marginBottom: theme.spacing(5) },
  switchStripContent: { gap: theme.spacing(2), paddingBottom: theme.spacing(3) },
  switchImage: { width: 100, height: 100, borderRadius: theme.radii.md, backgroundColor: theme.colors.surfaceSunken },
  switchEmpty: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    marginBottom: theme.spacing(3),
  },

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
  publishedRow: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.mintSoft,
    borderRadius: theme.radii.pill,
    paddingVertical: theme.spacing(2),
    paddingHorizontal: theme.spacing(4),
  },
  publishedText: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.mintDeep },
  offersRow: {
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.honeySoft,
    padding: theme.spacing(3),
    marginBottom: theme.spacing(4),
  },
  offersText: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.honeyDeep },
})
