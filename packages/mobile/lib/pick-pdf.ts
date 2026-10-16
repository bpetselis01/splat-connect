// packages/mobile/lib/pick-pdf.ts
//
// The Files picker and the upload, shared by the Steps choice card and the Files
// screen. Returns the stored path, or null when the person backed out.
import * as DocumentPicker from 'expo-document-picker'
import { uploadFile } from './upload'

export async function pickAndUploadPdf(tutorialId: string, onPicked?: () => void): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' })
  if (result.canceled || !result.assets?.[0]) return null
  const asset = result.assets[0]
  onPicked?.()
  const { url } = await uploadFile('/api/upload/pdf', tutorialId, {
    uri: asset.uri,
    name: asset.name,
    mimeType: asset.mimeType ?? 'application/pdf',
  })
  return url
}
