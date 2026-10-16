// packages/mobile/lib/pick-photo.ts
// The library picker with a look-before-you-use step. Every screen that takes a
// photo calls this instead of ImagePicker directly; <PhotoPreviewHost/> (mounted
// once in the root layout) shows what was chosen and resolves the question.
// With no host mounted (unit tests) the pick passes straight through.
import { Keyboard, Platform } from 'react-native'
import * as ImagePicker from 'expo-image-picker'

export type PreviewAnswer = 'use' | 'again' | 'cancel'
type Host = (uris: string[]) => Promise<PreviewAnswer>

// One host per mounted screen, the newest being the one on top. The preview is a
// Modal, and iOS only presents it from inside the screen that asked: a Modal in
// the root layout cannot present over a formSheet, so the pick just hung.
const hosts: Host[] = []

export function registerPhotoPreviewHost(h: Host): () => void {
  hosts.push(h)
  return () => {
    const i = hosts.lastIndexOf(h)
    if (i >= 0) hosts.splice(i, 1)
  }
}

export async function pickPreviewedPhoto(options: ImagePicker.ImagePickerOptions = {}): Promise<ImagePicker.ImagePickerResult> {
  // The title field's keyboard would otherwise still be up when the picker closes.
  Keyboard.dismiss()
  for (;;) {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'], ...options })
    if (result.canceled || !result.assets?.length || !hosts.length || Platform.OS === 'web') return result
    // iOS drops a Modal presented while the picker is still sliding away, which
    // left this awaiting forever on the phone.
    await new Promise((r) => setTimeout(r, 500))
    const answer = await hosts[hosts.length - 1]!(result.assets.map((a) => a.uri))
    if (answer === 'use') return result
    if (answer === 'cancel') return { canceled: true, assets: null }
  }
}
