// packages/mobile/components/my-tutorials/sections/files-section.tsx
//
// The guide PDF and its photos. Uploads are not debounced — there is a result
// to show and nothing to coalesce — so they go through saveNow, which still
// owns the concurrency token and the approved-to-pending requeue.
import { useState } from 'react'
import { View, Text, Image, Pressable, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { uploadFile } from '../../../lib/upload'
import { supabase } from '../../../lib/supabase'
import { useDraft } from '../../../lib/use-tutorial-draft'
import { MAX_PHOTOS } from '@splat-connect/types'
import { theme } from '../../../lib/theme'
import { Screen } from '../../ui/Screen'
import { Button } from '../../ui/Button'
import { ErrorRow } from '../../auth-screen'
import { SectionFooter } from '../section-footer'
import { PickerNote } from './picker-note'

export function FilesSection() {
  const router = useRouter()
  const { tutorial, saveNow, saveError } = useDraft()
  const [photoUploading, setPhotoUploading] = useState(false)
  const [pdfUploading, setPdfUploading] = useState(false)
  const [broken, setBroken] = useState<Set<string>>(new Set())
  const [localError, setLocalError] = useState<string | null>(null)

  if (!tutorial) return null

  const id = tutorial.id
  const currentPdfPath = tutorial.tutorial_pdf_url
  // Captured for the same reason the toy editor captures its own: TS does not
  // carry the `tutorial !== null` narrowing across a nested function boundary.
  const currentPhotoUrls = tutorial.photo_urls

  async function pickPhoto(source: 'camera' | 'library') {
    if (photoUploading) return
    setLocalError(null)
    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        setLocalError(
          source === 'camera'
            ? 'Camera access is needed to take a photo.'
            : 'Photo library access is needed to choose a photo.'
        )
        return
      }
      const remaining = MAX_PHOTOS - currentPhotoUrls.length
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
          : // The library takes as many as there are slots left (v57
            // selectionLimit, iOS 14+), so adding the last two is one trip.
            await ImagePicker.launchImageLibraryAsync({
              quality: 0.7,
              mediaTypes: ['images'],
              allowsMultipleSelection: remaining > 1,
              selectionLimit: remaining,
            })
      if (result.canceled || !result.assets?.length) return
      setPhotoUploading(true)

      const urls: string[] = []
      for (const asset of result.assets.slice(0, remaining)) {
        const { url } = await uploadFile('/api/upload/photo', id, {
          uri: asset.uri,
          name: asset.fileName ?? 'photo.jpg',
          mimeType: asset.mimeType ?? 'image/jpeg',
        })
        urls.push(url)
      }
      await saveNow({ photo_urls: [...currentPhotoUrls, ...urls] })
    } catch (err) {
      console.error('[FilesSection] photo upload failed:', err)
      setLocalError('Could not upload the photo. Please try again.')
    } finally {
      setPhotoUploading(false)
    }
  }

  async function removePhoto(url: string) {
    if (photoUploading) return
    setLocalError(null)
    setPhotoUploading(true)
    try {
      await saveNow({ photo_urls: currentPhotoUrls.filter((u) => u !== url) })
    } catch (err) {
      console.error('[FilesSection] photo remove failed:', err)
      setLocalError('Could not remove that photo. Please try again.')
    } finally {
      setPhotoUploading(false)
    }
  }

  async function makeCover(url: string) {
    if (photoUploading) return
    setLocalError(null)
    setPhotoUploading(true)
    try {
      await saveNow({ photo_urls: [url, ...currentPhotoUrls.filter((u) => u !== url)] })
    } catch (err) {
      console.error('[FilesSection] cover change failed:', err)
      setLocalError('Could not change the cover. Please try again.')
    } finally {
      setPhotoUploading(false)
    }
  }

  async function pickPdf() {
    setLocalError(null)
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
      await saveNow({ tutorial_pdf_url: url })
    } catch (err) {
      console.error('[FilesSection] pdf upload failed:', err)
      setLocalError('Could not upload the PDF. Please try again.')
    } finally {
      setPdfUploading(false)
    }
  }

  // 049 made tutorial-pdfs private: tutorial_pdf_url is an object path, not a
  // URL. Signed in-process with the app's own session, same as
  // components/home/detail-screen.tsx's openPreview — there is no /files route
  // on mobile to route through instead.
  async function openPdfPreview() {
    if (!currentPdfPath) return
    const { data, error } = await supabase.storage
      .from('tutorial-pdfs')
      .createSignedUrl(currentPdfPath, 60)
    router.push({
      pathname: '/guides/[id]/preview',
      params: { id, pdfUrl: error || !data ? '' : data.signedUrl },
    })
  }

  return (
    <Screen>
      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {/* Both halves are labelled. Unlabelled, the only thing naming the PDF
            was its own filename, so which button belonged to which artefact had
            to be read off the order they happened to be in. */}
        <Text style={styles.heading}>Photos of the toy</Text>
        <Text style={styles.photoHint}>
          Up to {MAX_PHOTOS}. The first one is the cover — it is what shows on cards and in search.
        </Text>

        {currentPhotoUrls.length > 0 ? (
          <View style={styles.photoGrid}>
            {currentPhotoUrls.map((url, i) => (
              <View key={url} style={styles.photoCell}>
                {broken.has(url) ? (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons
                      name="alert-circle-outline"
                      size={28}
                      color={theme.colors.apricotDeep}
                    />
                    <Text style={styles.photoBroken}>Saved, but it can&apos;t be shown here.</Text>
                  </View>
                ) : (
                  <Image
                    source={{ uri: url }}
                    style={styles.photoImage}
                    // Without this, a URL that will not decode leaves an empty
                    // bordered box: the placeholder has already been swapped out
                    // for an Image that draws nothing, and a photo is the one
                    // upload here with no filename to fall back on. Found via a
                    // 55-byte ASCII fixture named .jpg — the bucket is public and
                    // the happy path works, but the failure had no visible form
                    // at all. Tracked per URL now that there are five of them.
                    onError={() => setBroken((prev) => new Set(prev).add(url))}
                  />
                )}
                {i === 0 ? (
                  <View style={styles.coverFlag}>
                    <Text style={styles.coverFlagText}>Cover</Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => makeCover(url)}
                    disabled={photoUploading}
                    accessibilityRole="button"
                    accessibilityLabel={`Make photo ${i + 1} the cover`}
                    style={[styles.tileButton, styles.tileButtonLeft]}
                  >
                    <Ionicons name="star" size={15} color={theme.colors.ink} />
                  </Pressable>
                )}
                <Pressable
                  onPress={() => removePhoto(url)}
                  disabled={photoUploading}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove photo ${i + 1}`}
                  style={[styles.tileButton, styles.tileButtonRight]}
                >
                  <Ionicons name="close" size={15} color={theme.colors.ink} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="image-outline" size={32} color={theme.colors.primary} />
          </View>
        )}

        {currentPhotoUrls.length < MAX_PHOTOS ? (
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
        ) : (
          <Text style={styles.photoHint}>That is all {MAX_PHOTOS}. Remove one to add another.</Text>
        )}

        <Text style={styles.heading}>Guide PDF</Text>
        <View style={styles.pdfRow}>
          <Text style={styles.pdfLabel}>
            {currentPdfPath ? currentPdfPath.split('/').pop() : 'No PDF yet'}
          </Text>
          <Button
            label="Choose PDF from Files"
            variant="secondary"
            onPress={pickPdf}
            loading={pdfUploading}
          />
          {currentPdfPath ? (
            <Button label="Preview" variant="ghost" onPress={openPdfPreview} />
          ) : null}
        </View>
        <PickerNote noun="PDF" />

        <ErrorRow message={localError ?? saveError} />
      </ScrollView>
      <SectionFooter section="files" />
    </Screen>
  )
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  heading: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.label,
    color: theme.colors.text,
    marginBottom: theme.spacing(2),
  },
  photoBroken: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.apricotDeep,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: theme.spacing(2),
    paddingHorizontal: theme.spacing(4),
  },
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
  photoCell: { width: '47%', position: 'relative' },
  photoImage: {
    width: '100%',
    height: 110,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surfaceSunken,
  },
  photoPlaceholder: {
    width: '100%',
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentLight,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing(3),
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
  photoActions: { gap: theme.spacing(2) },
  pdfRow: { gap: theme.spacing(2), marginBottom: theme.spacing(2) },
  pdfLabel: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    marginBottom: theme.spacing(1),
  },
})
