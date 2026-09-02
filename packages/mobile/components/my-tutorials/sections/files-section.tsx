// packages/mobile/components/my-tutorials/sections/files-section.tsx
//
// The guide PDF and the photo. Uploads are not debounced — there is a result to
// show and nothing to coalesce — so they go through saveNow, which still owns
// the concurrency token and the approved-to-pending requeue.
import { useState } from 'react'
import { View, Text, Image, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { uploadFile } from '../../../lib/upload'
import { supabase } from '../../../lib/supabase'
import { useDraft } from '../../../lib/use-tutorial-draft'
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
  const [photoBroken, setPhotoBroken] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  if (!tutorial) return null

  const id = tutorial.id
  const currentPdfPath = tutorial.tutorial_pdf_url

  async function pickPhoto(source: 'camera' | 'library') {
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
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
          : await ImagePicker.launchImageLibraryAsync({ quality: 0.7 })
      if (result.canceled || !result.assets?.[0]) return
      const asset = result.assets[0]
      setPhotoUploading(true)
      setPhotoBroken(false)
      const { url } = await uploadFile('/api/upload/photo', id, {
        uri: asset.uri,
        name: asset.fileName ?? 'photo.jpg',
        mimeType: asset.mimeType ?? 'image/jpeg',
      })
      await saveNow({ toy_photo_url: url })
    } catch (err) {
      console.error('[FilesSection] photo upload failed:', err)
      setLocalError('Could not upload the photo. Please try again.')
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
        <Text style={styles.heading}>Photo of the toy</Text>
        <View style={styles.photoTile}>
          {tutorial.toy_photo_url && !photoBroken ? (
            <Image
              source={{ uri: tutorial.toy_photo_url }}
              style={styles.photoImage}
              // Without this, a URL that will not decode leaves an empty
              // bordered box: the placeholder has already been swapped out for
              // an Image that draws nothing, and the photo is the one upload
              // here with no filename to fall back on. Found via a 55-byte
              // ASCII fixture named .jpg — the bucket is public and the happy
              // path works, but the failure had no visible form at all.
              onError={() => setPhotoBroken(true)}
            />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons
                name={photoBroken ? 'alert-circle-outline' : 'image-outline'}
                size={32}
                color={photoBroken ? theme.colors.apricotDeep : theme.colors.primary}
              />
              {photoBroken ? (
                <Text style={styles.photoBroken}>
                  Photo saved, but it can&apos;t be shown here. Choose it again to replace it.
                </Text>
              ) : null}
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
  photoTile: { marginBottom: theme.spacing(5) },
  photoImage: {
    width: '100%',
    height: 180,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing(3),
  },
  photoPlaceholder: {
    width: '100%',
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentLight,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing(3),
  },
  photoActions: { gap: theme.spacing(2) },
  pdfRow: { gap: theme.spacing(2), marginBottom: theme.spacing(2) },
  pdfLabel: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    marginBottom: theme.spacing(1),
  },
})
