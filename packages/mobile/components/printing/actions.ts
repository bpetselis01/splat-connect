// packages/mobile/components/printing/actions.ts
/**
 * The writes a print job takes that more than one screen makes: the printer's
 * two moves (the job page and the Jobs tab both offer them) and the family's
 * withdraw.
 */
import * as ImagePicker from 'expo-image-picker'
import type { ToyTransaction } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { uploadFile } from '../../lib/upload'

export const startPrint = (id: string) =>
  apiClient.post<ToyTransaction>(`/api/toy-transactions/${id}/print-started`, {})

/**
 * Ready needs a photo — 058 will not store one without the other, so a family
 * never travels for a part on somebody's word alone. Null when the printer
 * backs out of the picker; throws when the library is refused, with a sentence
 * the caller can show.
 */
export async function markReady(id: string): Promise<ToyTransaction | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) {
    throw new Error('failed with status 400: Photo library access is needed to post the photo.')
  }
  const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] })
  if (result.canceled || !result.assets?.length) return null
  const asset = result.assets[0]!
  const updated = await uploadFile(`/api/toy-transactions/${id}/print-ready`, id, {
    uri: asset.uri,
    name: asset.fileName ?? 'ready.jpg',
    mimeType: asset.mimeType ?? 'image/jpeg',
  })
  return updated as unknown as ToyTransaction
}

/**
 * Withdraw the whole request, not the one job on screen: the API withdraws the
 * rest of the group when the family withdraws any job in it (074).
 */
export async function withdrawRequest(tx: Pick<ToyTransaction, 'id' | 'print_group_id'>): Promise<void> {
  await apiClient.post(`/api/toy-transactions/${tx.id}/withdraw`, {})
}
