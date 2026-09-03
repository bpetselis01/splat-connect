// packages/mobile/components/my-toys/editor.tsx
import { useEffect, useState } from 'react'
import { View, Text, ScrollView, Alert, Image, Pressable, Switch, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import type { OfferType, Toy, ToyTransactionSummary } from '@splat-connect/types'
import { isOwnerSide, MAX_PHOTOS } from '@splat-connect/types'
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
  photo_urls: string[]
  switch_adapted: boolean
  switch_photo_url: string | null
  offer_type: OfferType | null
}): Gap[] {
  const missing: Gap[] = []
  if (toy.photo_urls.length === 0) missing.push({ step: 'photos', label: 'A photo' })
  if (toy.switch_adapted && !toy.switch_photo_url)
    missing.push({ step: 'photos', label: 'A photo showing the switch' })
  if (!toy.offer_type) missing.push({ step: 'review', label: 'How it is offered' })
  return missing
}

/** Ported verbatim from web's lib/toy-steps.ts computeToyStepStatuses. */
function computeToyStepStatuses(toy: Toy): Record<ToyStepId, StepPillStatus> {
  const photosMissing =
    toy.photo_urls.length === 0 || (toy.switch_adapted && !toy.switch_photo_url)
  return {
    details: 'done',
    photos: photosMissing ? 'attention' : 'done',
    review: toy.status === 'published' ? 'done' : 'neutral',
  }
}

/** Mirrors 053's file_size_limit on the photo buckets. */
const MAX_PHOTO_BYTES = 10 * 1024 * 1024

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

  const [photosBusy, setPhotosBusy] = useState(false)
  const [photosError, setPhotosError] = useState<string | null>(null)

  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)

  // toys.ts is deliberately GET-collection-only ("nothing in the UI needs a
  // single-row fetch outside the collection"), so this reads the whole list
  // and picks the one row, same as web's dashboard/toys/[id]/page.tsx. The
  // transactions list rides along on the same load — Review's offers row
  // needs it, and there is no toy-scoped filter on the API to fetch it
  // lazily per step.
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
  const currentPhotoUrls = toy.photo_urls
  const currentSwitchPhotoUrl = toy.switch_photo_url

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

  /**
   * Picks one or more images. The library allows a multi-select capped at the
   * slots actually left (v57 `selectionLimit`, iOS 14+), so someone adding
   * their last two photos does not have to come back twice; the camera returns
   * one shot by definition.
   */
  async function pickImageAssets(source: 'camera' | 'library', remaining: number) {
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
      return []
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({
            quality: 0.7,
            mediaTypes: ['images'],
            allowsMultipleSelection: remaining > 1,
            selectionLimit: remaining,
          })
    if (result.canceled || !result.assets?.length) return []
    return result.assets
  }

  /** Saves the photo fields and folds the server's answer back into state. */
  async function savePhotos(fields: { photo_urls?: string[]; switch_photo_url?: string | null }) {
    const updated = await apiClient.patch<Toy>(`/api/toys/${id}`, fields)
    setToy((prev) => (prev ? { ...prev, ...updated } : updated))
  }

  async function addPhotos(source: 'camera' | 'library') {
    // Set before the picker (an async, user-paced step) rather than after it
    // resolves, and bail if a prior press is still in flight — otherwise the
    // camera and library buttons (or a fast double-press) can both reach the
    // upload below before either one's `loading` prop has re-rendered true.
    if (photosBusy) return
    setPhotosError(null)
    setPhotosBusy(true)
    try {
      const remaining = MAX_PHOTOS - currentPhotoUrls.length
      const assets = await pickImageAssets(source, remaining)
      if (!assets.length) return

      // Checked here as well as by the api and the bucket, because this is the
      // only one of the three that can say which photo was the problem while
      // the others still upload.
      const tooBig = assets.find((a) => (a.fileSize ?? 0) > MAX_PHOTO_BYTES)
      if (tooBig) {
        setPhotosError(
          `${tooBig.fileName ?? 'That photo'} is over 10 MB. Try a smaller one.`
        )
        return
      }

      const urls: string[] = []
      for (const asset of assets.slice(0, remaining)) {
        const { url } = await uploadFile(
          '/api/upload/toy-photo',
          id,
          {
            uri: asset.uri,
            name: asset.fileName ?? 'photo.jpg',
            mimeType: asset.mimeType ?? 'image/jpeg',
          },
          'toyId'
        )
        urls.push(url)
      }
      // One save for the batch, and built from the server's list rather than
      // local state, the way the switch gallery already was.
      await savePhotos({ photo_urls: [...currentPhotoUrls, ...urls] })
    } catch (err) {
      console.error('[Editor] photo upload failed:', err)
      setPhotosError('Could not upload the photo. Please try again.')
    } finally {
      setPhotosBusy(false)
    }
  }

  async function removePhoto(url: string) {
    if (photosBusy) return
    setPhotosError(null)
    setPhotosBusy(true)
    try {
      await savePhotos({
        photo_urls: currentPhotoUrls.filter((u) => u !== url),
        // A removed photo cannot go on being the one that shows the switch —
        // 053's toys_switch_photo_member would reject the save outright.
        ...(currentSwitchPhotoUrl === url ? { switch_photo_url: null } : {}),
      })
    } catch (err) {
      console.error('[Editor] photo remove failed:', err)
      setPhotosError('Could not remove that photo. Please try again.')
    } finally {
      setPhotosBusy(false)
    }
  }

  async function makeCover(url: string) {
    if (photosBusy) return
    setPhotosError(null)
    setPhotosBusy(true)
    try {
      await savePhotos({ photo_urls: [url, ...currentPhotoUrls.filter((u) => u !== url)] })
    } catch (err) {
      console.error('[Editor] cover change failed:', err)
      setPhotosError('Could not change the cover. Please try again.')
    } finally {
      setPhotosBusy(false)
    }
  }

  async function tagSwitchPhoto(url: string) {
    if (photosBusy) return
    setPhotosError(null)
    setPhotosBusy(true)
    try {
      await savePhotos({ switch_photo_url: url })
    } catch (err) {
      console.error('[Editor] switch tag failed:', err)
      setPhotosError('Could not save that. Please try again.')
    } finally {
      setPhotosBusy(false)
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
            <Text style={styles.label}>Photos</Text>
            <Text style={styles.photoHint}>
              Up to {MAX_PHOTOS}. The first one is the cover — it is what shows on cards and in
              search.
            </Text>

            {toy.photo_urls.length > 0 ? (
              <View style={styles.photoGrid}>
                {toy.photo_urls.map((url, i) => (
                  <View key={url} style={styles.photoCell}>
                    <View style={styles.photoTile}>
                      <Image source={{ uri: url }} style={styles.photoImage} />
                      {i === 0 ? (
                        <View style={styles.coverFlag}>
                          <Text style={styles.coverFlagText}>Cover</Text>
                        </View>
                      ) : (
                        <Pressable
                          onPress={() => makeCover(url)}
                          disabled={photosBusy}
                          accessibilityRole="button"
                          accessibilityLabel={`Make photo ${i + 1} the cover`}
                          style={[styles.tileButton, styles.tileButtonLeft]}
                        >
                          <Ionicons name="star" size={15} color={theme.colors.ink} />
                        </Pressable>
                      )}
                      <Pressable
                        onPress={() => removePhoto(url)}
                        disabled={photosBusy}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove photo ${i + 1}`}
                        style={[styles.tileButton, styles.tileButtonRight]}
                      >
                        <Ionicons name="close" size={15} color={theme.colors.ink} />
                      </Pressable>
                    </View>

                    {/* Gated on the persisted toy.switch_adapted, not the local
                        unsaved `switchAdapted` draft — every gap check
                        (getMissingToyFields, computeToyStepStatuses, the
                        server's own publish check) reads the saved column, so a
                        flipped-but-unsaved toggle must not open a path none of
                        them see. */}
                    {toy.switch_adapted ? (
                      <Pressable
                        onPress={() => tagSwitchPhoto(url)}
                        disabled={photosBusy}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: toy.switch_photo_url === url }}
                        accessibilityLabel={`Photo ${i + 1} shows the switch`}
                        style={styles.switchTagRow}
                      >
                        <Ionicons
                          name={
                            toy.switch_photo_url === url ? 'radio-button-on' : 'radio-button-off'
                          }
                          size={16}
                          color={theme.colors.primary}
                        />
                        <Text style={styles.switchTagText}>Shows the switch</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="image-outline" size={32} color={theme.colors.primary} />
              </View>
            )}

            {toy.photo_urls.length < MAX_PHOTOS ? (
              <View style={styles.photoActions}>
                <Button
                  label="Take a photo"
                  variant="secondary"
                  onPress={() => addPhotos('camera')}
                  loading={photosBusy}
                />
                <Button
                  label="Choose from library"
                  variant="secondary"
                  onPress={() => addPhotos('library')}
                  loading={photosBusy}
                />
              </View>
            ) : (
              <Text style={styles.photoHint}>
                That is all {MAX_PHOTOS}. Remove one to add another.
              </Text>
            )}

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
  photoHint: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    marginBottom: theme.spacing(3),
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing(3),
    marginBottom: theme.spacing(4),
  },
  // Two per row on the narrowest phone this ships to, with the gap taken out
  // of the width rather than left to overflow.
  photoCell: { width: '47%' },
  photoTile: { position: 'relative' },
  photoImage: {
    width: '100%',
    height: 110,
    borderRadius: theme.radii.md,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    backgroundColor: theme.colors.surfaceSunken,
  },
  coverFlag: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.apricot,
    borderTopWidth: theme.border.thin,
    borderTopColor: theme.colors.ink,
    borderBottomLeftRadius: theme.radii.md,
    borderBottomRightRadius: theme.radii.md,
    paddingVertical: theme.spacing(0.5),
  },
  coverFlagText: {
    fontFamily: theme.fonts.black,
    fontSize: 10,
    color: theme.colors.ink,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  // 32px square: the tap targets sit on top of a 110px tile, and anything
  // smaller is a control you aim at rather than press.
  tileButton: {
    position: 'absolute',
    top: theme.spacing(1.5),
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.sm,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    backgroundColor: theme.colors.surface,
  },
  tileButtonLeft: { left: theme.spacing(1.5) },
  tileButtonRight: { right: theme.spacing(1.5) },
  switchTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    paddingVertical: theme.spacing(1.5),
  },
  switchTagText: {
    fontFamily: theme.fonts.semiBold,
    fontSize: theme.type.caption,
    color: theme.colors.text,
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
