// packages/mobile/lib/pick-photo.ts
// The library picker with a look-before-you-use step. Every screen that takes a
// photo calls this instead of ImagePicker directly; <PhotoPreviewHost/> (mounted
// once in the root layout) shows what was chosen and resolves the question.
// With no host mounted (unit tests) the pick passes straight through.
import * as ImagePicker from 'expo-image-picker'

export type PreviewAnswer = 'use' | 'again' | 'cancel'
type Host = (uris: string[]) => Promise<PreviewAnswer>

let host: Host | null = null

export function registerPhotoPreviewHost(h: Host): () => void {
  host = h
  return () => {
    if (host === h) host = null
  }
}

export async function pickPreviewedPhoto(options: ImagePicker.ImagePickerOptions = {}): Promise<ImagePicker.ImagePickerResult> {
  for (;;) {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'], ...options })
    if (result.canceled || !result.assets?.length || !host) return result
    const answer = await host(result.assets.map((a) => a.uri))
    if (answer === 'use') return result
    if (answer === 'cancel') return { canceled: true, assets: null }
  }
}
