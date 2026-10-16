// packages/mobile/components/my-tutorials/sections/files-section.tsx
//
// The guide PDF. Uploads are not debounced — there is a result to show and
// nothing to coalesce — so they go through saveNow, which still owns the
// concurrency token and the approved-to-pending requeue.
import { logFailure } from '../../../lib/log'
import { useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { pickAndUploadPdf } from '../../../lib/pick-pdf'
import { supabase } from '../../../lib/supabase'
import { useDraft } from '../../../lib/use-tutorial-draft'
import { SectionProgress } from './section-progress'
import { theme } from '../../../lib/theme'
import { Screen } from '../../ui/Screen'
import { Button } from '../../ui/Button'
import { ErrorRow } from '../../ui/ErrorRow'
import { SectionFooter } from '../section-footer'
import { PickerNote } from './picker-note'

export function FilesSection() {
  const router = useRouter()
  const { tutorial, saveNow, saveError } = useDraft()
  const [pdfUploading, setPdfUploading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  if (!tutorial) return null

  const id = tutorial.id
  const currentPdfPath = tutorial.tutorial_pdf_url

  async function pickPdf() {
    setLocalError(null)
    try {
      const url = await pickAndUploadPdf(id, () => setPdfUploading(true))
      if (url) await saveNow({ tutorial_pdf_url: url })
    } catch (err) {
      logFailure('[FilesSection] pdf upload failed:', err)
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
      <ScrollView style={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
        <SectionProgress section="files" />
        <Text style={styles.heading}>{(tutorial.steps?.length ?? 0) > 0 ? 'Guide PDF (optional)' : 'Guide PDF'}</Text>
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
  // The board's uppercase group label, as list-kit's ListSection draws it.
  heading: {
    fontFamily: theme.fonts.black,
    fontSize: theme.type.caption,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: theme.colors.muted,
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(2),
  },
  pdfRow: { gap: theme.spacing(2), marginBottom: theme.spacing(2) },
  pdfLabel: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    marginBottom: theme.spacing(1),
  },
})
